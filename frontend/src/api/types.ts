// TypeScript interfaces mirroring the FastAPI Pydantic models from src/api/schemas.py

export interface PortfolioSummary {
  total_projects: number;
  total_tasks: number;
  total_deviations: number;
  critical_deviations: number;
  total_cost: number;
  total_baseline_cost: number;
  total_actual_cost: number;
}

export interface ProjectHealth {
  id: number;
  name: string;
  tasks: number;
  budget: number;
  actual_cost: number;
  cpi: number | null;
  spi: number | null;
  critical_issues: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  file_format: string;
  start: string | null;
  finish: string | null;
  cost: number | null;
  baseline_cost: number | null;
  actual_cost: number | null;
  task_count: number;
  deviation_count: number;
}

export interface ProjectDetail {
  id: number;
  name: string;
  file_path: string;
  file_format: string;
  ingested_at: string | null;
  start: string | null;
  finish: string | null;
  baseline_start: string | null;
  baseline_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  status_date: string | null;
  cost: number | null;
  baseline_cost: number | null;
  actual_cost: number | null;
  bcws: number | null;
  bcwp: number | null;
  acwp: number | null;
  task_count: number;
  resource_count: number;
  assignment_count: number;
  deviation_count: number;
}

export interface TaskItem {
  task_uid: number;
  task_id: number | null;
  name: string;
  wbs: string | null;
  outline_level: number | null;
  start: string | null;
  finish: string | null;
  baseline_start: string | null;
  baseline_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  duration_hours: number | null;
  baseline_duration_hours: number | null;
  actual_duration_hours: number | null;
  percent_complete: number | null;
  cost: number | null;
  baseline_cost: number | null;
  actual_cost: number | null;
  critical: boolean | null;
  milestone: boolean | null;
  summary: boolean | null;
  resource_names: string | null;
}

export interface CostMetrics {
  budget_at_completion: number;
  actual_cost: number;
  cost_variance: number | null;
  cost_variance_percent: number | null;
  bcwp: number | null;
  acwp: number | null;
  cpi: number | null;
  eac: number | null;
  vac: number | null;
}

export interface SlippedMilestone {
  task_uid: number;
  name: string;
  baseline_finish: string | null;
  current_finish: string | null;
  slip_days: number;
}

export interface CriticalTaskBehind {
  task_uid: number;
  name: string;
  slip_days: number;
}

export interface ScheduleMetrics {
  spi: number | null;
  schedule_variance_days: number | null;
  bcwp: number | null;
  bcws: number | null;
  slipped_milestones: SlippedMilestone[];
  critical_tasks_behind: CriticalTaskBehind[];
  total_milestones: number;
  milestones_on_track: number;
}

export interface TaskOverrun {
  task_uid: number;
  name: string;
  baseline_hours: number | null;
  actual_hours: number | null;
  overrun_hours: number;
}

export interface TimeMetrics {
  total_planned_hours: number;
  total_actual_hours: number;
  total_remaining_hours: number;
  duration_variance_hours: number;
  tasks_with_overrun: TaskOverrun[];
  critical_path_length_hours: number;
}

export interface OrphanedTask {
  task_uid: number;
  name: string;
}

export interface IntegrityMetrics {
  overall_score: number;
  baseline_coverage: number;
  cost_completeness: number;
  resource_coverage: number;
  progress_tracking: number;
  orphaned_tasks: OrphanedTask[];
  missing_resource_assignments: number;
  total_tasks: number;
  total_resources: number;
  total_assignments: number;
}

export interface DeviationItem {
  id: number;
  severity: string;
  project_id: number;
  project_name: string;
  deviation_type: string;
  metric_name: string;
  baseline_value: string | null;
  actual_value: string | null;
  variance: number | null;
  variance_percent: number | null;
  description: string;
}

export interface DeviationSummary {
  total: number;
  critical: number;
  warning: number;
  by_type: Record<string, number>;
  by_project: Record<string, number>;
}

export interface IngestionRequest {
  directories: string[];
  use_cache: boolean;
  batch_size: number;
}

export interface IngestionResult {
  files_discovered: number;
  files_parsed: number;
  files_skipped: number;
  files_errored: number;
  errors: string[];
}

export interface IngestionStatus {
  total_projects: number;
  total_tasks: number;
  total_deviations: number;
}

export interface NLQueryRequest {
  question: string;
}

export interface NLQueryResponse {
  answer: string;
}

// --- Plan View (unified project metrics) ---

export interface PlanViewItem {
  id: number;
  name: string;
  file_format: string;
  // Schedule dates
  start: string | null;
  finish: string | null;
  baseline_start: string | null;
  baseline_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  // Counts
  task_count: number;
  resource_count: number;
  deviation_count: number;
  critical_issues: number;
  // Cost metrics
  budget: number;
  actual_cost: number;
  cost_variance: number | null;
  cost_variance_percent: number | null;
  eac: number | null;
  vac: number | null;
  // Earned value
  pv: number | null;
  ev: number | null;
  ac: number | null;
  cpi: number | null;
  spi: number | null;
  cv: number | null;
  sv: number | null;
  tcpi: number | null;
  percent_complete: number;
  health_status: string;
  // Schedule metrics
  schedule_variance_days: number | null;
  slipped_milestones: number;
  total_milestones: number;
  critical_tasks_behind: number;
  // Time metrics
  total_planned_hours: number;
  total_actual_hours: number;
  total_remaining_hours: number;
  duration_variance_hours: number;
  tasks_with_overrun: number;
  critical_path_length_hours: number;
  // Integrity
  integrity_score: number;
  baseline_coverage: number;
}

// Filter parameter types for API calls

export interface TaskFilters {
  critical?: boolean;
  milestones?: boolean;
  summary?: boolean;
}

export interface DeviationFilters {
  severity?: string;
  project_id?: number;
  type?: string;
}

// --- Earned Value ---

export interface EVMetrics {
  project_id: number;
  project_name: string;
  pv: number;
  ev: number;
  ac: number;
  bac: number;
  cpi: number | null;
  spi: number | null;
  cv: number;
  sv: number;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpi: number | null;
  percent_complete: number;
  health_status: string;
  data_quality: string;
  task_count: number;
  tasks_with_baseline: number;
  tasks_with_progress: number;
}

export interface PortfolioEVSummary {
  total_pv: number;
  total_ev: number;
  total_ac: number;
  total_bac: number;
  portfolio_cpi: number | null;
  portfolio_spi: number | null;
  portfolio_cv: number;
  portfolio_sv: number;
  projects_on_track: number;
  projects_watch: number;
  projects_at_risk: number;
  projects_critical: number;
  projects_insufficient_data: number;
  projects: EVMetrics[];
}

// --- Fiscal Year Planning ---

export interface DNORegion {
  code: string;
  name: string;
}

export interface PlanRegionInput {
  region_code: string;
  region_name: string;
  priority: number;
  target_sites: number;
  capex_per_site: number;
  contractors: number;
  team_size_per_contractor: number;
  max_sites_per_team_per_month: number;
  lead_time_months: number;
  build_time_days: number;
}

export interface PlanRegionResponse extends PlanRegionInput {
  id: number;
  plan_id: number;
}

export interface CreatePlanRequest {
  name: string;
  fiscal_year: number;
  target_sockets: number;
  avg_sockets_per_site: number;
  contingency_percent: number;
  notes?: string;
  regions: PlanRegionInput[];
}

export interface UpdatePlanRequest {
  name?: string;
  fiscal_year?: number;
  target_sockets?: number;
  avg_sockets_per_site?: number;
  contingency_percent?: number;
  notes?: string;
  regions?: PlanRegionInput[];
}

export interface MonthlyAllocationResponse {
  id: number;
  region_code: string;
  month: number;
  planned_sites: number;
  planned_sockets: number;
  cumulative_sockets: number;
  capex: number;
  is_contingency: boolean;
  contingency_source_region: string | null;
  actual_sockets: number;
}

export interface UpdateActualsEntry {
  region_code: string;
  month: number;
  actual_sockets: number;
}

export interface UpdateActualsRequest {
  actuals: UpdateActualsEntry[];
}

export interface FiscalPlanSummary {
  id: number;
  name: string;
  fiscal_year: number;
  target_sockets: number;
  status: string;
  avg_sockets_per_site: number;
  contingency_percent: number;
  created_at: string | null;
  updated_at: string | null;
  total_achieved_sockets: number;
  total_capex: number;
  region_count: number;
}

export interface FiscalPlanDetail {
  id: number;
  name: string;
  fiscal_year: number;
  target_sockets: number;
  status: string;
  avg_sockets_per_site: number;
  contingency_percent: number;
  ai_analysis: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  regions: PlanRegionResponse[];
  allocations: MonthlyAllocationResponse[];
  total_achieved_sockets: number;
  total_capex: number;
  capacity_utilization: Record<string, number>;
  hierarchy: CustomRegionResponse[];
  contract_allocations: ContractAllocationResponse[];
  total_revenue: number;
  total_opex: number;
}

// --- Contract Hierarchy ---

export interface ContractInput {
  name: string;
  reference?: string;
  status: string;
  dno_regions: string[];
  contractors: number;
  team_size_per_contractor: number;
  max_sites_per_team_per_month: number;
  lead_time_months: number;
  build_time_days: number;
  target_sites: number;
  priority: number;
  capex_bom: number;
  capex_dno: number;
  capex_survey: number;
  capex_council: number;
  opex_per_site: number;
  revenue_per_site: number;
  redundancy_percent: number;
  contingency_percent: number;
}

export interface ContractResponse extends ContractInput {
  id: number;
  council_id: number;
  plan_id: number;
}

export interface CouncilInput {
  name: string;
  code: string;
  contact_info?: string;
  default_capex_bom?: number;
  default_capex_dno?: number;
  default_capex_survey?: number;
  default_capex_council?: number;
  default_opex?: number;
  default_revenue_per_site?: number;
  contracts: ContractInput[];
}

export interface CouncilResponse {
  id: number;
  custom_region_id: number;
  plan_id: number;
  name: string;
  code: string;
  contact_info?: string;
  default_capex_bom?: number;
  default_capex_dno?: number;
  default_capex_survey?: number;
  default_capex_council?: number;
  default_opex?: number;
  default_revenue_per_site?: number;
  contracts: ContractResponse[];
}

export interface CustomRegionInput {
  name: string;
  code: string;
  description?: string;
  default_capex_bom: number;
  default_capex_dno: number;
  default_capex_survey: number;
  default_capex_council: number;
  default_opex: number;
  default_revenue_per_site: number;
  councils: CouncilInput[];
}

export interface CustomRegionResponse {
  id: number;
  plan_id: number;
  name: string;
  code: string;
  description?: string;
  default_capex_bom: number;
  default_capex_dno: number;
  default_capex_survey: number;
  default_capex_council: number;
  default_opex: number;
  default_revenue_per_site: number;
  councils: CouncilResponse[];
}

export interface HierarchyInput {
  custom_regions: CustomRegionInput[];
}

export interface ContractAllocationResponse {
  id: number;
  contract_id: number;
  plan_id: number;
  month: number;
  planned_sites: number;
  planned_sockets: number;
  actual_sockets: number | null;
  is_contingency: boolean;
}
