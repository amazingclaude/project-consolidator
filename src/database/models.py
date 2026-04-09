from datetime import datetime
from typing import Optional, List
from sqlalchemy import ForeignKey, String, Float, Integer, Boolean, DateTime, Text, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(1000), unique=True)
    file_format: Mapped[str] = mapped_column(String(10))
    source_directory: Mapped[str] = mapped_column(String(1000))
    file_hash: Mapped[Optional[str]] = mapped_column(String(64))
    file_modified: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    finish: Mapped[Optional[datetime]] = mapped_column(DateTime)
    baseline_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    baseline_finish: Mapped[Optional[datetime]] = mapped_column(DateTime)
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    actual_finish: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status_date: Mapped[Optional[datetime]] = mapped_column(DateTime)

    cost: Mapped[Optional[float]] = mapped_column(Float)
    baseline_cost: Mapped[Optional[float]] = mapped_column(Float)
    actual_cost: Mapped[Optional[float]] = mapped_column(Float)

    bcws: Mapped[Optional[float]] = mapped_column(Float)
    bcwp: Mapped[Optional[float]] = mapped_column(Float)
    acwp: Mapped[Optional[float]] = mapped_column(Float)

    tasks: Mapped[List["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    resources: Mapped[List["Resource"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    assignments: Mapped[List["Assignment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    deviations: Mapped[List["Deviation"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_project_uid", "project_id", "task_uid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    task_uid: Mapped[int] = mapped_column(Integer)
    task_id: Mapped[Optional[int]] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(1000))
    wbs: Mapped[Optional[str]] = mapped_column(String(200))
    outline_level: Mapped[Optional[int]] = mapped_column(Integer)
    parent_task_uid: Mapped[Optional[int]] = mapped_column(Integer)

    start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    finish: Mapped[Optional[datetime]] = mapped_column(DateTime)
    baseline_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    baseline_finish: Mapped[Optional[datetime]] = mapped_column(DateTime)
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    actual_finish: Mapped[Optional[datetime]] = mapped_column(DateTime)

    duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    baseline_duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    actual_duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    remaining_duration_hours: Mapped[Optional[float]] = mapped_column(Float)

    percent_complete: Mapped[Optional[float]] = mapped_column(Float)
    physical_percent_complete: Mapped[Optional[float]] = mapped_column(Float)

    cost: Mapped[Optional[float]] = mapped_column(Float)
    baseline_cost: Mapped[Optional[float]] = mapped_column(Float)
    actual_cost: Mapped[Optional[float]] = mapped_column(Float)
    remaining_cost: Mapped[Optional[float]] = mapped_column(Float)
    fixed_cost: Mapped[Optional[float]] = mapped_column(Float)

    bcws: Mapped[Optional[float]] = mapped_column(Float)
    bcwp: Mapped[Optional[float]] = mapped_column(Float)
    acwp: Mapped[Optional[float]] = mapped_column(Float)

    critical: Mapped[Optional[bool]] = mapped_column(Boolean)
    milestone: Mapped[Optional[bool]] = mapped_column(Boolean)
    summary: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_null: Mapped[Optional[bool]] = mapped_column(Boolean)

    free_slack_hours: Mapped[Optional[float]] = mapped_column(Float)
    total_slack_hours: Mapped[Optional[float]] = mapped_column(Float)

    resource_names: Mapped[Optional[str]] = mapped_column(Text)
    predecessor_uids: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    project: Mapped["Project"] = relationship(back_populates="tasks")


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    resource_uid: Mapped[int] = mapped_column(Integer)
    name: Mapped[Optional[str]] = mapped_column(String(500))
    resource_type: Mapped[Optional[int]] = mapped_column(Integer)
    max_units: Mapped[Optional[float]] = mapped_column(Float)
    standard_rate: Mapped[Optional[float]] = mapped_column(Float)
    overtime_rate: Mapped[Optional[float]] = mapped_column(Float)
    cost: Mapped[Optional[float]] = mapped_column(Float)
    actual_cost: Mapped[Optional[float]] = mapped_column(Float)

    project: Mapped["Project"] = relationship(back_populates="resources")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    assignment_uid: Mapped[int] = mapped_column(Integer)
    task_uid: Mapped[int] = mapped_column(Integer)
    resource_uid: Mapped[int] = mapped_column(Integer)

    work_hours: Mapped[Optional[float]] = mapped_column(Float)
    actual_work_hours: Mapped[Optional[float]] = mapped_column(Float)
    baseline_work_hours: Mapped[Optional[float]] = mapped_column(Float)
    remaining_work_hours: Mapped[Optional[float]] = mapped_column(Float)

    cost: Mapped[Optional[float]] = mapped_column(Float)
    actual_cost: Mapped[Optional[float]] = mapped_column(Float)
    baseline_cost: Mapped[Optional[float]] = mapped_column(Float)

    start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    finish: Mapped[Optional[datetime]] = mapped_column(DateTime)
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    actual_finish: Mapped[Optional[datetime]] = mapped_column(DateTime)

    project: Mapped["Project"] = relationship(back_populates="assignments")


class Deviation(Base):
    __tablename__ = "deviations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    task_uid: Mapped[Optional[int]] = mapped_column(Integer)

    deviation_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20))

    metric_name: Mapped[str] = mapped_column(String(100))
    baseline_value: Mapped[Optional[str]] = mapped_column(String(200))
    actual_value: Mapped[Optional[str]] = mapped_column(String(200))
    variance: Mapped[Optional[float]] = mapped_column(Float)
    variance_percent: Mapped[Optional[float]] = mapped_column(Float)

    description: Mapped[str] = mapped_column(Text)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="deviations")


class IngestionLog(Base):
    __tablename__ = "ingestion_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_started: Mapped[datetime] = mapped_column(DateTime)
    run_finished: Mapped[Optional[datetime]] = mapped_column(DateTime)
    files_discovered: Mapped[int] = mapped_column(Integer, default=0)
    files_parsed: Mapped[int] = mapped_column(Integer, default=0)
    files_skipped: Mapped[int] = mapped_column(Integer, default=0)
    files_errored: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[Optional[str]] = mapped_column(Text)


class FiscalPlan(Base):
    __tablename__ = "fiscal_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500))
    fiscal_year: Mapped[int] = mapped_column(Integer)
    target_sockets: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    avg_sockets_per_site: Mapped[float] = mapped_column(Float, default=6.0)
    contingency_percent: Mapped[float] = mapped_column(Float, default=10.0)
    ai_analysis: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    regions: Mapped[List["PlanRegion"]] = relationship(back_populates="plan", cascade="all, delete-orphan")
    allocations: Mapped[List["PlanMonthlyAllocation"]] = relationship(back_populates="plan", cascade="all, delete-orphan")
    custom_regions: Mapped[List["PlanCustomRegion"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanRegion(Base):
    __tablename__ = "plan_regions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("fiscal_plans.id", ondelete="CASCADE"))
    region_code: Mapped[str] = mapped_column(String(20))
    region_name: Mapped[str] = mapped_column(String(200))
    priority: Mapped[int] = mapped_column(Integer, default=5)
    target_sites: Mapped[int] = mapped_column(Integer, default=0)
    capex_per_site: Mapped[float] = mapped_column(Float, default=0.0)
    contractors: Mapped[int] = mapped_column(Integer, default=1)
    team_size_per_contractor: Mapped[int] = mapped_column(Integer, default=4)
    max_sites_per_team_per_month: Mapped[int] = mapped_column(Integer, default=2)
    lead_time_months: Mapped[int] = mapped_column(Integer, default=2)
    build_time_days: Mapped[int] = mapped_column(Integer, default=30)

    plan: Mapped["FiscalPlan"] = relationship(back_populates="regions")


class PlanMonthlyAllocation(Base):
    __tablename__ = "plan_monthly_allocations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("fiscal_plans.id", ondelete="CASCADE"))
    region_code: Mapped[str] = mapped_column(String(20))
    month: Mapped[int] = mapped_column(Integer)
    planned_sites: Mapped[int] = mapped_column(Integer, default=0)
    planned_sockets: Mapped[int] = mapped_column(Integer, default=0)
    cumulative_sockets: Mapped[int] = mapped_column(Integer, default=0)
    capex: Mapped[float] = mapped_column(Float, default=0.0)
    is_contingency: Mapped[bool] = mapped_column(Boolean, default=False)
    contingency_source_region: Mapped[Optional[str]] = mapped_column(String(20))
    actual_sockets: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped["FiscalPlan"] = relationship(back_populates="allocations")


class PlanCustomRegion(Base):
    __tablename__ = "plan_custom_regions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("fiscal_plans.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    default_capex_bom: Mapped[float] = mapped_column(Float, default=0.0)
    default_capex_dno: Mapped[float] = mapped_column(Float, default=0.0)
    default_capex_survey: Mapped[float] = mapped_column(Float, default=0.0)
    default_capex_council: Mapped[float] = mapped_column(Float, default=0.0)
    default_opex: Mapped[float] = mapped_column(Float, default=0.0)
    default_revenue_per_site: Mapped[float] = mapped_column(Float, default=0.0)

    plan: Mapped["FiscalPlan"] = relationship(back_populates="custom_regions")
    councils: Mapped[List["PlanCouncil"]] = relationship(back_populates="custom_region", cascade="all, delete-orphan")


class PlanCouncil(Base):
    __tablename__ = "plan_councils"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    custom_region_id: Mapped[int] = mapped_column(ForeignKey("plan_custom_regions.id", ondelete="CASCADE"))
    plan_id: Mapped[int] = mapped_column(ForeignKey("fiscal_plans.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(50))
    contact_info: Mapped[Optional[str]] = mapped_column(Text)
    default_capex_bom: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_capex_dno: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_capex_survey: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_capex_council: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_opex: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_revenue_per_site: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    custom_region: Mapped["PlanCustomRegion"] = relationship(back_populates="councils")
    plan: Mapped["FiscalPlan"] = relationship()
    contracts: Mapped[List["PlanContract"]] = relationship(back_populates="council", cascade="all, delete-orphan")


class PlanContract(Base):
    __tablename__ = "plan_contracts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    council_id: Mapped[int] = mapped_column(ForeignKey("plan_councils.id", ondelete="CASCADE"))
    plan_id: Mapped[int] = mapped_column(ForeignKey("fiscal_plans.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(300))
    reference: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="active")
    dno_regions: Mapped[Optional[str]] = mapped_column(Text)  # JSON array stored as text
    # Capacity params
    contractors: Mapped[int] = mapped_column(Integer, default=1)
    team_size_per_contractor: Mapped[int] = mapped_column(Integer, default=4)
    max_sites_per_team_per_month: Mapped[int] = mapped_column(Integer, default=2)
    lead_time_months: Mapped[int] = mapped_column(Integer, default=2)
    build_time_days: Mapped[int] = mapped_column(Integer, default=30)
    target_sites: Mapped[int] = mapped_column(Integer, default=0)
    priority: Mapped[int] = mapped_column(Integer, default=5)
    # Cost breakdown
    capex_bom: Mapped[float] = mapped_column(Float, default=0.0)
    capex_dno: Mapped[float] = mapped_column(Float, default=0.0)
    capex_survey: Mapped[float] = mapped_column(Float, default=0.0)
    capex_council: Mapped[float] = mapped_column(Float, default=0.0)
    opex_per_site: Mapped[float] = mapped_column(Float, default=0.0)
    revenue_per_site: Mapped[float] = mapped_column(Float, default=0.0)
    # Contingency
    redundancy_percent: Mapped[float] = mapped_column(Float, default=0.0)
    contingency_percent: Mapped[float] = mapped_column(Float, default=10.0)

    council: Mapped["PlanCouncil"] = relationship(back_populates="contracts")
    plan: Mapped["FiscalPlan"] = relationship()
    contract_allocations: Mapped[List["PlanContractAllocation"]] = relationship(back_populates="contract", cascade="all, delete-orphan")


class PlanContractAllocation(Base):
    __tablename__ = "plan_contract_allocations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("plan_contracts.id", ondelete="CASCADE"))
    plan_id: Mapped[int] = mapped_column(ForeignKey("fiscal_plans.id", ondelete="CASCADE"))
    month: Mapped[int] = mapped_column(Integer)
    planned_sites: Mapped[int] = mapped_column(Integer, default=0)
    planned_sockets: Mapped[int] = mapped_column(Integer, default=0)
    actual_sockets: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_contingency: Mapped[bool] = mapped_column(Boolean, default=False)

    contract: Mapped["PlanContract"] = relationship(back_populates="contract_allocations")
    plan: Mapped["FiscalPlan"] = relationship()
