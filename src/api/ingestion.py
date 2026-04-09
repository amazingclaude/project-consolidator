import json
import yaml
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..database.queries import get_portfolio_summary
from ..ingestion.pipeline import IngestionPipeline
from .schemas import IngestionRequest, IngestionResult, IngestionStatus

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


def _load_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "..", "config.yaml")
    config_path = os.path.normpath(config_path)
    if os.path.exists(config_path):
        with open(config_path) as f:
            return yaml.safe_load(f) or {}
    return {}


@router.post("/run", response_model=IngestionResult)
def run_ingestion(req: IngestionRequest, db: Session = Depends(get_db)):
    config = _load_config()
    config["parsing"] = {"use_cache": req.use_cache, "batch_size": req.batch_size}

    pipeline = IngestionPipeline(db, config)
    log = pipeline.run(directories=req.directories)

    errors = []
    if log.errors:
        try:
            errors = json.loads(log.errors)
        except (json.JSONDecodeError, TypeError):
            errors = [str(log.errors)]

    return IngestionResult(
        files_discovered=log.files_discovered,
        files_parsed=log.files_parsed,
        files_skipped=log.files_skipped,
        files_errored=log.files_errored,
        errors=errors,
    )


@router.get("/status", response_model=IngestionStatus)
def ingestion_status(db: Session = Depends(get_db)):
    summary = get_portfolio_summary(db)
    return IngestionStatus(
        total_projects=summary["total_projects"],
        total_tasks=summary["total_tasks"],
        total_deviations=summary["total_deviations"],
    )
