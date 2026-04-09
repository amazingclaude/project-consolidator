from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ParsedTask:
    uid: int
    task_id: Optional[int] = None
    name: str = ""
    wbs: Optional[str] = None
    outline_level: Optional[int] = None
    parent_task_uid: Optional[int] = None
    start: Optional[datetime] = None
    finish: Optional[datetime] = None
    baseline_start: Optional[datetime] = None
    baseline_finish: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None
    duration_hours: Optional[float] = None
    baseline_duration_hours: Optional[float] = None
    actual_duration_hours: Optional[float] = None
    remaining_duration_hours: Optional[float] = None
    percent_complete: Optional[float] = None
    physical_percent_complete: Optional[float] = None
    cost: Optional[float] = None
    baseline_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    remaining_cost: Optional[float] = None
    fixed_cost: Optional[float] = None
    bcws: Optional[float] = None
    bcwp: Optional[float] = None
    acwp: Optional[float] = None
    critical: Optional[bool] = None
    milestone: Optional[bool] = None
    summary: Optional[bool] = None
    is_null: Optional[bool] = None
    free_slack_hours: Optional[float] = None
    total_slack_hours: Optional[float] = None
    resource_names: Optional[str] = None
    predecessor_uids: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ParsedResource:
    uid: int
    name: Optional[str] = None
    resource_type: Optional[int] = None
    max_units: Optional[float] = None
    standard_rate: Optional[float] = None
    overtime_rate: Optional[float] = None
    cost: Optional[float] = None
    actual_cost: Optional[float] = None


@dataclass
class ParsedAssignment:
    uid: int
    task_uid: int = 0
    resource_uid: int = 0
    work_hours: Optional[float] = None
    actual_work_hours: Optional[float] = None
    baseline_work_hours: Optional[float] = None
    remaining_work_hours: Optional[float] = None
    cost: Optional[float] = None
    actual_cost: Optional[float] = None
    baseline_cost: Optional[float] = None
    start: Optional[datetime] = None
    finish: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None


@dataclass
class ParsedProject:
    name: str = ""
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
    tasks: list[ParsedTask] = field(default_factory=list)
    resources: list[ParsedResource] = field(default_factory=list)
    assignments: list[ParsedAssignment] = field(default_factory=list)


class BaseParser:
    def can_parse(self, file_path: str) -> bool:
        raise NotImplementedError

    def parse(self, file_path: str) -> ParsedProject:
        raise NotImplementedError
