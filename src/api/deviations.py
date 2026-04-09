from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..database.queries import get_all_projects, get_deviations
from .schemas import DeviationItem, DeviationSummary

router = APIRouter(prefix="/api/deviations", tags=["deviations"])


@router.get("", response_model=list[DeviationItem])
def list_deviations(
    project_id: int = Query(None),
    severity: str = Query(None),
    deviation_type: str = Query(None, alias="type"),
    db: Session = Depends(get_db),
):
    projects = get_all_projects(db)
    name_map = {p.id: p.name for p in projects}

    devs = get_deviations(db, project_id=project_id, severity=severity)

    if deviation_type:
        devs = [d for d in devs if d.deviation_type == deviation_type]

    return [
        DeviationItem(
            id=d.id,
            severity=d.severity,
            project_id=d.project_id,
            project_name=name_map.get(d.project_id, "Unknown"),
            deviation_type=d.deviation_type,
            metric_name=d.metric_name,
            baseline_value=d.baseline_value,
            actual_value=d.actual_value,
            variance=d.variance,
            variance_percent=d.variance_percent,
            description=d.description,
        )
        for d in devs
    ]


@router.get("/summary", response_model=DeviationSummary)
def deviation_summary(db: Session = Depends(get_db)):
    projects = get_all_projects(db)
    name_map = {p.id: p.name for p in projects}
    devs = get_deviations(db)

    by_type: dict[str, int] = {}
    by_project: dict[str, int] = {}
    critical = 0
    warning = 0

    for d in devs:
        t = d.deviation_type
        by_type[t] = by_type.get(t, 0) + 1
        pname = name_map.get(d.project_id, "Unknown")
        by_project[pname] = by_project.get(pname, 0) + 1
        if d.severity == "critical":
            critical += 1
        else:
            warning += 1

    return DeviationSummary(
        total=len(devs),
        critical=critical,
        warning=warning,
        by_type=by_type,
        by_project=by_project,
    )
