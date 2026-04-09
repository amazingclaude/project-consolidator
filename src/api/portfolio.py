from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..database.queries import get_all_projects, get_portfolio_summary, get_deviations
from ..metrics.cost import calculate_project_cost_metrics
from ..metrics.schedule import calculate_project_schedule_metrics
from ..metrics.time_metrics import calculate_time_metrics
from ..metrics.integrity import calculate_integrity_metrics
from ..metrics.earned_value import compute_portfolio_ev, compute_project_ev
from .schemas import PortfolioSummary, ProjectHealth, PortfolioEVSummary, EVMetrics, PlanViewItem

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/summary", response_model=PortfolioSummary)
def portfolio_summary(db: Session = Depends(get_db)):
    return get_portfolio_summary(db)


@router.get("/health", response_model=list[ProjectHealth])
def portfolio_health(db: Session = Depends(get_db)):
    projects = get_all_projects(db)
    result = []
    for p in projects:
        tasks = p.tasks
        cost_m = calculate_project_cost_metrics(p)
        sched_m = calculate_project_schedule_metrics(p, tasks)
        devs = get_deviations(db, project_id=p.id, severity="critical")
        non_summary = [t for t in tasks if not t.summary and not t.is_null]
        result.append(ProjectHealth(
            id=p.id,
            name=p.name,
            tasks=len(non_summary),
            budget=p.baseline_cost or 0,
            actual_cost=p.actual_cost or 0,
            cpi=cost_m["cpi"],
            spi=sched_m["spi"],
            critical_issues=len(devs),
        ))
    return result


@router.get("/plans", response_model=list[PlanViewItem])
def portfolio_plans(db: Session = Depends(get_db)):
    """Unified view of all projects with combined metrics for the Plan View page."""
    projects = get_all_projects(db)
    result = []
    for p in projects:
        tasks = list(p.tasks)
        resources = list(p.resources)
        assignments = list(p.assignments)
        non_summary = [t for t in tasks if not t.summary and not t.is_null]

        # Cost metrics
        cost_m = calculate_project_cost_metrics(p, tasks)
        # Schedule metrics
        sched_m = calculate_project_schedule_metrics(p, tasks)
        # Time metrics
        time_m = calculate_time_metrics(tasks)
        # Integrity metrics
        integrity_m = calculate_integrity_metrics(p, tasks, resources, assignments)
        # Earned value
        pev = compute_project_ev(p, tasks)
        # Deviations
        all_devs = get_deviations(db, project_id=p.id)
        crit_devs = [d for d in all_devs if d.severity == "critical"]

        result.append(PlanViewItem(
            id=p.id,
            name=p.name,
            file_format=p.file_format or "",
            start=p.start,
            finish=p.finish,
            baseline_start=p.baseline_start,
            baseline_finish=p.baseline_finish,
            actual_start=p.actual_start,
            actual_finish=p.actual_finish,
            task_count=len(non_summary),
            resource_count=len(resources),
            deviation_count=len(all_devs),
            critical_issues=len(crit_devs),
            budget=cost_m["budget_at_completion"],
            actual_cost=cost_m["actual_cost"],
            cost_variance=cost_m["cost_variance"],
            cost_variance_percent=cost_m["cost_variance_percent"],
            eac=cost_m["eac"],
            vac=cost_m["vac"],
            pv=pev.pv,
            ev=pev.ev,
            ac=pev.ac,
            cpi=pev.cpi if pev.cpi is not None else cost_m["cpi"],
            spi=pev.spi if pev.spi is not None else sched_m["spi"],
            cv=pev.cv,
            sv=pev.sv,
            tcpi=pev.tcpi,
            percent_complete=pev.percent_complete,
            health_status=pev.health_status,
            schedule_variance_days=sched_m["schedule_variance_days"],
            slipped_milestones=len(sched_m["slipped_milestones"]),
            total_milestones=sched_m["total_milestones"],
            critical_tasks_behind=len(sched_m["critical_tasks_behind"]),
            total_planned_hours=time_m["total_planned_hours"],
            total_actual_hours=time_m["total_actual_hours"],
            total_remaining_hours=time_m["total_remaining_hours"],
            duration_variance_hours=time_m["duration_variance_hours"],
            tasks_with_overrun=len(time_m["tasks_with_overrun"]),
            critical_path_length_hours=time_m["critical_path_length_hours"],
            integrity_score=integrity_m["overall_score"],
            baseline_coverage=integrity_m["baseline_coverage"],
        ))
    return result


@router.get("/ev-comparison", response_model=PortfolioEVSummary)
def portfolio_ev_comparison(db: Session = Depends(get_db)):
    """Get comparable CPI/SPI data across all projects using earned value analysis."""
    projects = get_all_projects(db)
    pairs = [(p, list(p.tasks)) for p in projects]
    pev = compute_portfolio_ev(pairs)
    return PortfolioEVSummary(
        total_pv=pev.total_pv,
        total_ev=pev.total_ev,
        total_ac=pev.total_ac,
        total_bac=pev.total_bac,
        portfolio_cpi=pev.portfolio_cpi,
        portfolio_spi=pev.portfolio_spi,
        portfolio_cv=pev.portfolio_cv,
        portfolio_sv=pev.portfolio_sv,
        projects_on_track=pev.projects_on_track,
        projects_watch=pev.projects_watch,
        projects_at_risk=pev.projects_at_risk,
        projects_critical=pev.projects_critical,
        projects_insufficient_data=pev.projects_insufficient_data,
        projects=[
            EVMetrics(
                project_id=p.project_id,
                project_name=p.project_name,
                pv=p.pv, ev=p.ev, ac=p.ac, bac=p.bac,
                cpi=p.cpi, spi=p.spi,
                cv=p.cv, sv=p.sv,
                eac=p.eac, etc=p.etc, vac=p.vac, tcpi=p.tcpi,
                percent_complete=p.percent_complete,
                health_status=p.health_status,
                data_quality=p.data_quality,
                task_count=p.task_count,
                tasks_with_baseline=p.tasks_with_baseline,
                tasks_with_progress=p.tasks_with_progress,
            )
            for p in pev.projects
        ],
    )
