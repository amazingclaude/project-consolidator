from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from .models import Project, Task, Resource, Assignment, Deviation


def get_all_projects(session: Session) -> list[Project]:
    return list(session.scalars(select(Project).order_by(Project.name)))


def get_project_by_id(session: Session, project_id: int) -> Project | None:
    return session.get(Project, project_id)


def get_tasks_for_project(session: Session, project_id: int) -> list[Task]:
    return list(session.scalars(
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.task_uid)
    ))


def get_resources_for_project(session: Session, project_id: int) -> list[Resource]:
    return list(session.scalars(
        select(Resource).where(Resource.project_id == project_id)
    ))


def get_assignments_for_project(session: Session, project_id: int) -> list[Assignment]:
    return list(session.scalars(
        select(Assignment).where(Assignment.project_id == project_id)
    ))


def get_critical_tasks(session: Session, project_id: int) -> list[Task]:
    return list(session.scalars(
        select(Task)
        .where(Task.project_id == project_id, Task.critical == True)
        .order_by(Task.start)
    ))


def get_milestones(session: Session, project_id: int) -> list[Task]:
    return list(session.scalars(
        select(Task)
        .where(Task.project_id == project_id, Task.milestone == True)
        .order_by(Task.start)
    ))


def get_deviations(
    session: Session,
    project_id: int = None,
    severity: str = None,
) -> list[Deviation]:
    stmt = select(Deviation)
    if project_id is not None:
        stmt = stmt.where(Deviation.project_id == project_id)
    if severity is not None:
        stmt = stmt.where(Deviation.severity == severity)
    return list(session.scalars(stmt.order_by(Deviation.detected_at.desc())))


def get_portfolio_summary(session: Session) -> dict:
    total_projects = session.scalar(select(func.count(Project.id))) or 0
    total_tasks = session.scalar(select(func.count(Task.id))) or 0
    total_deviations = session.scalar(select(func.count(Deviation.id))) or 0
    critical_deviations = session.scalar(
        select(func.count(Deviation.id)).where(Deviation.severity == "critical")
    ) or 0
    total_cost = session.scalar(select(func.sum(Project.cost))) or 0.0
    total_baseline_cost = session.scalar(select(func.sum(Project.baseline_cost))) or 0.0
    total_actual_cost = session.scalar(select(func.sum(Project.actual_cost))) or 0.0

    return {
        "total_projects": total_projects,
        "total_tasks": total_tasks,
        "total_deviations": total_deviations,
        "critical_deviations": critical_deviations,
        "total_cost": total_cost,
        "total_baseline_cost": total_baseline_cost,
        "total_actual_cost": total_actual_cost,
    }


def run_raw_sql(session: Session, sql: str) -> list[dict]:
    result = session.execute(text(sql))
    columns = list(result.keys())
    return [dict(zip(columns, row)) for row in result.fetchall()]
