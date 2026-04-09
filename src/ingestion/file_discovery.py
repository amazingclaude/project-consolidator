import os
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class DiscoveredFile:
    path: str
    format: str
    source_directory: str
    file_modified: datetime
    file_hash: str
    size_bytes: int


def compute_file_hash(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def is_mspdi_xml(file_path: str) -> bool:
    try:
        with open(file_path, "rb") as f:
            header = f.read(2048).decode("utf-8", errors="ignore")
        return "schemas.microsoft.com/project" in header
    except Exception:
        return False


def discover_files(directories: list[str]) -> list[DiscoveredFile]:
    found = []
    for directory in directories:
        if not os.path.isdir(directory):
            logger.warning(f"Directory not found, skipping: {directory}")
            continue
        for root_dir, _dirs, files in os.walk(directory):
            for filename in files:
                file_path = os.path.join(root_dir, filename)
                ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

                if ext == "mpp":
                    fmt = "mpp"
                elif ext == "xml" and is_mspdi_xml(file_path):
                    fmt = "xml"
                else:
                    continue

                try:
                    stat = os.stat(file_path)
                    found.append(DiscoveredFile(
                        path=file_path,
                        format=fmt,
                        source_directory=directory,
                        file_modified=datetime.fromtimestamp(stat.st_mtime),
                        file_hash=compute_file_hash(file_path),
                        size_bytes=stat.st_size,
                    ))
                except OSError as e:
                    logger.warning(f"Cannot access {file_path}: {e}")

    logger.info(f"Discovered {len(found)} project files across {len(directories)} directories")
    return found
