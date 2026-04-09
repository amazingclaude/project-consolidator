from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..database.queries import (
    get_all_projects, get_project_by_id, get_tasks_for_project,
    get_resources_for_project, get_assignments_for_project, get_deviations,
)
from ..metrics.cost import calculate_project_cost_metrics
from ..metrics.schedule import calculate_project_schedule_metrics
from ..metrics.time_metrics import calculate_time_metrics
from ..metrics.integrity import calculate_integrity_metrics
from ..metrics.earned_value import compute_project_ev
from .schemas import (
    ProjectSummary, ProjectDetail, TaskItem, CostMetrics,
    ScheduleMetrics, TimeMetrics, IntegrityMetrics, DeviationItem,
    EVMetrics,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_project_or_404(db: Session, project_id: int):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    projects = get_all_projects(db)
    return [
        ProjectSummary(
            id=p.id,
            name=p.name,
            file_format=p.file_format,
            start=p.start,
            finish=p.finish,
            cost=p.cost,
            baseline_cost=p.baseline_cost,
            actual_cost=p.actual_cost,
            task_count=len(p.tasks),
            deviation_count=len(p.deviations),
        )
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = _get_project_or_404(db, project_id)
    return ProjectDetail(
        id=p.id,
        name=p.name,
        file_path=p.file_path,
        file_format=p.file_format,
        ingested_at=p.ingested_at,
        start=p.start,
        finish=p.finish,
        baseline_start=p.baseline_start,
        baseline_finish=p.baseline_finish,
        actual_start=p.actual_start,
        actual_finish=p.actual_finish,
        status_date=p.status_date,
        cost=p.cost,
        baseline_cost=p.baseline_cost,
        actual_cost=p.actual_cost,
        bcws=p.bcws,
        bcwp=p.bcwp,
        acwp=p.acwp,
        task_count=len(p.tasks),
        resource_count=len(p.resources),
        assignment_count=len(p.assignments),
        deviation_count=len(p.deviations),
    )


@router.get("/{project_id}/tasks", response_model=list[TaskItem])
def get_tasks(
    project_id: int,
    critical: bool = Query(None),
    milestones: bool = Query(None),
    summary: bool = Query(False),
    db: Session = Depends(get_db),
):
    _get_project_or_404(db, project_id)
    tasks = get_tasks_for_project(db, project_id)
    result = []
    for t in tasks:
        if not summary and t.summary:
            continue
        if t.is_null:
            continue
        if critical is not None and t.critical != critical:
            continue
        if milestones is not None and t.milestone != milestones:
            continue
        result.append(TaskItem(
            task_uid=t.task_uid,
            task_id=t.task_id,
            name=t.name,
            wbs=t.wbs,
            outline_level=t.outline_level,
            start=t.start,
            finish=t.finish,
            baseline_start=t.baseline_start,
            baseline_finish=t.baseline_finish,
            actual_start=t.actual_start,
            actual_finish=t.actual_finish,
            duration_hours=t.duration_hours,
            baseline_duration_hours=t.baseline_duration_hours,
            actual_duration_hours=t.actual_duration_hours,
            percent_complete=t.percent_complete,
            cost=t.cost,
            baseline_cost=t.baseline_cost,
            actual_cost=t.actual_cost,
            critical=t.critical,
            milestone=t.milestone,
            summary=t.summary,
            resource_names=t.resource_names,
        ))
    return result


@router.get("/{project_id}/cost-metrics", response_model=CostMetrics)
def get_cost_metrics(project_id: int, db: Session = Depends(get_db)):
    p = _get_project_or_404(db, project_id)
    tasks = get_tasks_for_project(db, project_id)
    return calculate_project_cost_metrics(p, tasks)


@router.get("/{project_id}/schedule-metrics", response_model=ScheduleMetrics)
def get_schedule_metrics(project_id: int, db: Session = Depends(get_db)):
    p = _get_project_or_404(db, project_id)
    tasks = get_tasks_for_project(db, project_id)
    return calculate_project_schedule_metrics(p, tasks)


@router.get("/{project_id}/time-metrics", response_model=TimeMetrics)
def get_time_metrics(project_id: int, db: Session = Depends(get_db)):
    _get_project_or_404(db, project_id)
    tasks = get_tasks_for_project(db, project_id)
    return calculate_time_metrics(tasks)


@router.get("/{project_id}/integrity-metrics", response_model=IntegrityMetrics)
def get_integrity_metrics(project_id: int, db: Session = Depends(get_db)):
    p = _get_project_or_404(db, project_id)
    tasks = get_tasks_for_project(db, project_id)
    resources = get_resources_for_project(db, project_id)
    assignments = get_assignments_for_project(db, project_id)
    return calculate_integrity_metrics(p, tasks, resources, assignments)


@router.get("/{project_id}/ev-metrics", response_model=EVMetrics)
def get_ev_metrics(project_id: int, db: Session = Depends(get_db)):
    """Full earned value metrics for a single project, derived from task data."""
    p = _get_project_or_404(db, project_id)
    tasks = get_tasks_for_project(db, project_id)
    pev = compute_project_ev(p, tasks)
    return EVMetrics(
        project_id=pev.project_id,
        project_name=pev.project_name,
        pv=pev.pv, ev=pev.ev, ac=pev.ac, bac=pev.bac,
        cpi=pev.cpi, spi=pev.spi,
        cv=pev.cv, sv=pev.sv,
        eac=pev.eac, etc=pev.etc, vac=pev.vac, tcpi=pev.tcpi,
        percent_complete=pev.percent_complete,
        health_status=pev.health_status,
        data_quality=pev.data_quality,
        task_count=pev.task_count,
        tasks_with_baseline=pev.tasks_with_baseline,
        tasks_with_progress=pev.tasks_with_progress,
    )


@router.get("/{project_id}/deviations", response_model=list[DeviationItem])
def get_project_deviations(project_id: int, db: Session = Depends(get_db)):
    p = _get_project_or_404(db, project_id)
    devs = get_deviations(db, project_id=project_id)
    return [
        DeviationItem(
            id=d.id,
            severity=d.severity,
            project_id=d.project_id,
            project_name=p.name,
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
