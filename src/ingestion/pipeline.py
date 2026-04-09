import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from ..parsers.mpp_parser import MppParser
from ..parsers.xml_parser import XmlParser
from .file_discovery import discover_files, DiscoveredFile
from .normalizer import normalize_to_models
from ..database.models import Project, IngestionLog
from ..metrics.red_line import detect_deviations

logger = logging.getLogger(__name__)


class IngestionPipeline:
    def __init__(self, session: Session, config: dict):
        self.session = session
        self.config = config
        self.parsers = [MppParser(), XmlParser()]

    def _get_parser(self, file: DiscoveredFile):
        for parser in self.parsers:
            if parser.can_parse(file.path):
                return parser
        return None

    def _should_skip(self, file: DiscoveredFile) -> bool:
        if not self.config.get("parsing", {}).get("use_cache", True):
            return False
        existing = self.session.query(Project).filter_by(file_path=file.path).first()
        if existing and existing.file_hash == file.file_hash:
            return True
        return False

    def _delete_existing(self, file_path: str):
        existing = self.session.query(Project).filter_by(file_path=file_path).first()
        if existing:
            self.session.delete(existing)
            self.session.flush()

    def run(self, directories: list[str] = None, progress_callback=None) -> IngestionLog:
        dirs = directories or self.config.get("input_directories", [])
        log = IngestionLog(
            run_started=datetime.utcnow(),
            files_discovered=0,
            files_parsed=0,
            files_skipped=0,
            files_errored=0,
        )
        errors = []

        discovered = discover_files(dirs)
        log.files_discovered = len(discovered)

        batch_size = self.config.get("parsing", {}).get("batch_size", 20)

        for i, file in enumerate(discovered):
            try:
                if progress_callback:
                    progress_callback(i + 1, len(discovered), file.path)

                if self._should_skip(file):
                    log.files_skipped += 1
                    continue

                parser = self._get_parser(file)
                if parser is None:
                    log.files_errored += 1
                    errors.append(f"No parser for: {file.path}")
                    continue

                logger.info(f"Parsing [{i+1}/{len(discovered)}]: {file.path}")
                parsed = parser.parse(file.path)

                self._delete_existing(file.path)

                project = normalize_to_models(
                    parsed, file.path, file.format,
                    file.source_directory, file.file_hash, file.file_modified,
                )
                self.session.add(project)
                self.session.flush()

                # Run deviation detection
                thresholds = self.config.get("thresholds", {})
                deviations = detect_deviations(project, thresholds)
                for dev in deviations:
                    project.deviations.append(dev)

                log.files_parsed += 1

                if (i + 1) % batch_size == 0:
                    self.session.commit()
                    logger.info(f"Committed batch at file {i+1}")

            except Exception as e:
                logger.error(f"Error parsing {file.path}: {e}")
                log.files_errored += 1
                errors.append(f"{file.path}: {str(e)}")
                self.session.rollback()

        self.session.commit()

        log.run_finished = datetime.utcnow()
        log.errors = json.dumps(errors) if errors else None
        self.session.add(log)
        self.session.commit()

        logger.info(
            f"Ingestion complete: {log.files_parsed} parsed, "
            f"{log.files_skipped} skipped, {log.files_errored} errors"
        )
        return log
