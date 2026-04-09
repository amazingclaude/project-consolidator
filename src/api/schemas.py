from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# --- Portfolio ---

class PortfolioSummary(BaseModel):
    total_projects: int
    total_tasks: int
    total_deviations: int
    critical_deviations: int
    total_cost: float
    total_baseline_cost: float
    total_actual_cost: float


class ProjectHealth(BaseModel):
    id: int
    name: str
    tasks: int
    budget: float
    actual_cost: float
    cpi: Optional[float] = None
    spi: Optional[float] = None
    critical_issues: int


# --- Projects ---

class ProjectSummary(BaseModel):
    id: int
    name: str
    file_format: str
    start: Optional[datetime] = None
    finish: Optional[datetime] = None
    cost: Optional[float] = None
    baseline_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    task_count: int
    deviation_count: int


class ProjectDetail(BaseModel):
    id: int
    name: str
    file_path: str
    file_format: str
    ingested_at: Optional[datetime] = None
    start: Optional[datetime] = None
    finish: Optional[datetime] = None
    baseline_start: Optional[datetime] = None
    baseline_finish: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None
    status_date: Optional[datetime] = None
    cost: Optional[float] = None
    baseline_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    bcws: Optional[float] = None
    bcwp: Optional[float] = None
    acwp: Optional[float] = None
    task_count: int
    resource_count: int
    assignment_count: int
    deviation_count: int


# --- Tasks ---

class TaskItem(BaseModel):
    task_uid: int
    task_id: Optional[int] = None
    name: str
    wbs: Optional[str] = None
    outline_level: Optional[int] = None
    start: Optional[datetime] = None
    finish: Optional[datetime] = None
    baseline_start: Optional[datetime] = None
    baseline_finish: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None
    duration_hours: Optional[float] = None
    baseline_duration_hours: Optional[float] = None
    actual_duration_hours: Optional[float] = None
    percent_complete: Optional[float] = None
    cost: Optional[float] = None
    baseline_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    critical: Optional[bool] = None
    milestone: Optional[bool] = None
    summary: Optional[bool] = None
    resource_names: Optional[str] = None


# --- Metrics ---

class CostMetrics(BaseModel):
    budget_at_completion: float
    actual_cost: float
    cost_variance: Optional[float] = None
    cost_variance_percent: Optional[float] = None
    bcwp: Optional[float] = None
    acwp: Optional[float] = None
    cpi: Optional[float] = None
    eac: Optional[float] = None
    vac: Optional[float] = None


class SlippedMilestone(BaseModel):
    task_uid: int
    name: str
    baseline_finish: Optional[datetime] = None
    current_finish: Optional[datetime] = None
    slip_days: float


class CriticalTaskBehind(BaseModel):
    task_uid: int
    name: str
    slip_days: float


class ScheduleMetrics(BaseModel):
    spi: Optional[float] = None
    schedule_variance_days: Optional[float] = None
    bcwp: Optional[float] = None
    bcws: Optional[float] = None
    slipped_milestones: list[SlippedMilestone] = []
    critical_tasks_behind: list[CriticalTaskBehind] = []
    total_milestones: int = 0
    milestones_on_track: int = 0


class TaskOverrun(BaseModel):
    task_uid: int
    name: str
    baseline_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    overrun_hours: float


class TimeMetrics(BaseModel):
    total_planned_hours: float
    total_actual_hours: float
    total_remaining_hours: float
    duration_variance_hours: float
    tasks_with_overrun: list[TaskOverrun] = []
    critical_path_length_hours: float


class OrphanedTask(BaseModel):
    task_uid: int
    name: str


class IntegrityMetrics(BaseModel):
    overall_score: float
    baseline_coverage: float
    cost_completeness: float
    resource_coverage: float
    progress_tracking: float
    orphaned_tasks: list[OrphanedTask] = []
    missing_resource_assignments: int
    total_tasks: int
    total_resources: int
    total_assignments: int


# --- Deviations ---

class DeviationItem(BaseModel):
    id: int
    severity: str
    project_id: int
    project_name: str
    deviation_type: str
    metric_name: str
    baseline_value: Optional[str] = None
    actual_value: Optional[str] = None
    variance: Optional[float] = None
    variance_percent: Optional[float] = None
    description: str


class DeviationSummary(BaseModel):
    total: int
    critical: int
    warning: int
    by_type: dict[str, int]
    by_project: dict[str, int]


# --- Ingestion ---

class IngestionRequest(BaseModel):
    directories: list[str]
    use_cache: bool = True
    batch_size: int = 20


class IngestionResult(BaseModel):
    files_discovered: int
    files_parsed: int
    files_skipped: int
    files_errored: int
    errors: list[str] = []


class IngestionStatus(BaseModel):
    total_projects: int
    total_tasks: int
    total_deviations: int


# --- NL Query ---

class NLQueryRequest(BaseModel):
    question: str


class NLQueryResponse(BaseModel):
    answer: str


# --- Earned Value ---

class EVMetrics(BaseModel):
    """Full earned value metrics for a single project."""
    project_id: int
    project_name: str
    pv: float                       # Planned Value (BCWS)
    ev: float                       # Earned Value  (BCWP)
    ac: float                       # Actual Cost   (ACWP)
    bac: float                      # Budget at Completion
    cpi: Optional[float] = None     # Cost Performance Index
    spi: Optional[float] = None     # Schedule Performance Index
    cv: float                       # Cost Variance  (EV − AC)
    sv: float                       # Schedule Variance (EV − PV)
    eac: Optional[float] = None     # Estimate at Completion
    etc: Optional[float] = None     # Estimate to Complete
    vac: Optional[float] = None     # Variance at Completion
    tcpi: Optional[float] = None    # To-Complete Performance Index
    percent_complete: float          # Cost-weighted % complete
    health_status: str               # on-track | watch | at-risk | critical | insufficient-data
    data_quality: str                # full | partial | insufficient
    task_count: int = 0
    tasks_with_baseline: int = 0
    tasks_with_progress: int = 0


class PortfolioEVSummary(BaseModel):
    """Portfolio-level aggregated earned value."""
    total_pv: float
    total_ev: float
    total_ac: float
    total_bac: float
    portfolio_cpi: Optional[float] = None
    portfolio_spi: Optional[float] = None
    portfolio_cv: float
    portfolio_sv: float
    projects_on_track: int = 0
    projects_watch: int = 0
    projects_at_risk: int = 0
    projects_critical: int = 0
    projects_insufficient_data: int = 0
    projects: list[EVMetrics] = []


# --- Plan View (unified project metrics) ---

class PlanViewItem(BaseModel):
    """Unified view combining all project metrics into a single flat record."""
    id: int
    name: str
    file_format: str
    # Schedule dates
    start: Optional[datetime] = None
    finish: Optional[datetime] = None
    baseline_start: Optional[datetime] = None
    baseline_finish: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None
    # Counts
    task_count: int = 0
    resource_count: int = 0
    deviation_count: int = 0
    critical_issues: int = 0
    # Cost metrics
    budget: float = 0
    actual_cost: float = 0
    cost_variance: Optional[float] = None
    cost_variance_percent: Optional[float] = None
    eac: Optional[float] = None
    vac: Optional[float] = None
    # Earned value
    pv: Optional[float] = None
    ev: Optional[float] = None
    ac: Optional[float] = None
    cpi: Optional[float] = None
    spi: Optional[float] = None
    cv: Optional[float] = None
    sv: Optional[float] = None
    tcpi: Optional[float] = None
    percent_complete: float = 0
    health_status: str = "insufficient-data"
    # Schedule metrics
    schedule_variance_days: Optional[float] = None
    slipped_milestones: int = 0
    total_milestones: int = 0
    critical_tasks_behind: int = 0
    # Time metrics
    total_planned_hours: float = 0
    total_actual_hours: float = 0
    total_remaining_hours: float = 0
    duration_variance_hours: float = 0
    tasks_with_overrun: int = 0
    critical_path_length_hours: float = 0
    # Integrity
    integrity_score: float = 0
    baseline_coverage: float = 0


# --- Fiscal Year Planning ---

class DNORegion(BaseModel):
    code: str
    name: str


class PlanRegionInput(BaseModel):
    region_code: str
    region_name: str
    priority: int = 5
    target_sites: int = 0
    capex_per_site: float = 0.0
    contractors: int = 1
    team_size_per_contractor: int = 4
    max_sites_per_team_per_month: int = 2
    lead_time_months: int = 2
    build_time_days: int = 30


class PlanRegionResponse(PlanRegionInput):
    id: int
    plan_id: int


class CreatePlanRequest(BaseModel):
    name: str
    fiscal_year: int
    target_sockets: int
    avg_sockets_per_site: float = 6.0
    contingency_percent: float = 10.0
    notes: Optional[str] = None
    regions: list[PlanRegionInput] = []


class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    fiscal_year: Optional[int] = None
    target_sockets: Optional[int] = None
    avg_sockets_per_site: Optional[float] = None
    contingency_percent: Optional[float] = None
    notes: Optional[str] = None
    regions: Optional[list[PlanRegionInput]] = None


class MonthlyAllocationResponse(BaseModel):
    id: int
    region_code: str
    month: int
    planned_sites: int
    planned_sockets: int
    cumulative_sockets: int
    capex: float
    is_contingency: bool
    contingency_source_region: Optional[str] = None
    actual_sockets: int = 0


class UpdateActualsRequest(BaseModel):
    actuals: list[dict]  # [{"region_code": "ENWL", "month": 1, "actual_sockets": 42}, ...]


class FiscalPlanSummary(BaseModel):
    id: int
    name: str
    fiscal_year: int
    target_sockets: int
    status: str
    avg_sockets_per_site: float
    contingency_percent: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    total_achieved_sockets: int = 0
    total_capex: float = 0.0
    region_count: int = 0


class FiscalPlanDetail(BaseModel):
    id: int
    name: str
    fiscal_year: int
    target_sockets: int
    status: str
    avg_sockets_per_site: float
    contingency_percent: float
    ai_analysis: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    regions: list[PlanRegionResponse] = []
    allocations: list[MonthlyAllocationResponse] = []
    total_achieved_sockets: int = 0
    total_capex: float = 0.0
    capacity_utilization: dict[str, float] = {}
    hierarchy: list = []
    contract_allocations: list = []
    total_revenue: float = 0.0
    total_opex: float = 0.0


class UpdateStatusRequest(BaseModel):
    status: str  # "draft", "optimized", "approved"


class PlanChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class PlanChatRequest(BaseModel):
    question: str
    history: list[PlanChatMessage] = []


class PlanChatResponse(BaseModel):
    answer: str


# --- Contract Hierarchy ---

class ContractInput(BaseModel):
    name: str
    reference: Optional[str] = None
    status: str = "active"
    dno_regions: list[str] = []
    contractors: int = 1
    team_size_per_contractor: int = 4
    max_sites_per_team_per_month: int = 2
    lead_time_months: int = 2
    build_time_days: int = 30
    target_sites: int = 0
    priority: int = 5
    capex_bom: float = 0.0
    capex_dno: float = 0.0
    capex_survey: float = 0.0
    capex_council: float = 0.0
    opex_per_site: float = 0.0
    revenue_per_site: float = 0.0
    redundancy_percent: float = 0.0
    contingency_percent: float = 10.0


class ContractResponse(ContractInput):
    id: int
    council_id: int
    plan_id: int


class CouncilInput(BaseModel):
    name: str
    code: str = ""
    contact_info: Optional[str] = None
    default_capex_bom: Optional[float] = None
    default_capex_dno: Optional[float] = None
    default_capex_survey: Optional[float] = None
    default_capex_council: Optional[float] = None
    default_opex: Optional[float] = None
    default_revenue_per_site: Optional[float] = None
    contracts: list[ContractInput] = []


class CouncilResponse(BaseModel):
    id: int
    custom_region_id: int
    plan_id: int
    name: str
    code: str
    contact_info: Optional[str] = None
    default_capex_bom: Optional[float] = None
    default_capex_dno: Optional[float] = None
    default_capex_survey: Optional[float] = None
    default_capex_council: Optional[float] = None
    default_opex: Optional[float] = None
    default_revenue_per_site: Optional[float] = None
    contracts: list[ContractResponse] = []


class CustomRegionInput(BaseModel):
    name: str
    code: str = ""
    description: Optional[str] = None
    default_capex_bom: float = 0.0
    default_capex_dno: float = 0.0
    default_capex_survey: float = 0.0
    default_capex_council: float = 0.0
    default_opex: float = 0.0
    default_revenue_per_site: float = 0.0
    councils: list[CouncilInput] = []


class CustomRegionResponse(BaseModel):
    id: int
    plan_id: int
    name: str
    code: str
    description: Optional[str] = None
    default_capex_bom: float = 0.0
    default_capex_dno: float = 0.0
    default_capex_survey: float = 0.0
    default_capex_council: float = 0.0
    default_opex: float = 0.0
    default_revenue_per_site: float = 0.0
    councils: list[CouncilResponse] = []


class HierarchyInput(BaseModel):
    custom_regions: list[CustomRegionInput] = []


class ContractAllocationResponse(BaseModel):
    id: int
    contract_id: int
    plan_id: int
    month: int
    planned_sites: int
    planned_sockets: int
    actual_sockets: Optional[int] = None
    is_contingency: bool = False


class UpdateContractActualsRequest(BaseModel):
    actuals: list[dict]  # [{"contract_id": 1, "month": 1, "actual_sockets": 42}, ...]
