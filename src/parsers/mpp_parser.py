import jpype
import logging
from datetime import datetime
from .base_parser import (
    BaseParser, ParsedProject, ParsedTask, ParsedResource, ParsedAssignment,
)

logger = logging.getLogger(__name__)

_jvm_started = False


def ensure_jvm():
    global _jvm_started
    if not _jvm_started and not jpype.isJVMStarted():
        jpype.startJVM(
            "-Dlog4j2.loggerContextFactory="
            "org.apache.logging.log4j.simple.SimpleLoggerContextFactory"
        )
        _jvm_started = True


def _java_date_to_python(java_date) -> datetime | None:
    if java_date is None:
        return None
    try:
        return datetime(
            java_date.getYear(),
            java_date.getMonthValue(),
            java_date.getDayOfMonth(),
            java_date.getHour(),
            java_date.getMinute(),
            java_date.getSecond(),
        )
    except Exception:
        return None


def _java_duration_to_hours(duration) -> float | None:
    if duration is None:
        return None
    try:
        from net.sf.mpxj import TimeUnit
        val = duration.getDuration()
        units = duration.getUnits()
        if units == TimeUnit.HOURS:
            return float(val)
        elif units == TimeUnit.DAYS:
            return float(val) * 8.0
        elif units == TimeUnit.WEEKS:
            return float(val) * 40.0
        elif units == TimeUnit.MONTHS:
            return float(val) * 160.0
        elif units == TimeUnit.MINUTES:
            return float(val) / 60.0
        else:
            return float(val) * 8.0
    except Exception:
        return None


def _java_number_to_float(num) -> float | None:
    if num is None:
        return None
    try:
        return float(num.doubleValue())
    except Exception:
        try:
            return float(str(num))
        except Exception:
            return None


def _java_bool(val) -> bool | None:
    if val is None:
        return None
    try:
        return bool(val.booleanValue())
    except Exception:
        try:
            return bool(val)
        except Exception:
            return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        return int(str(val))
    except Exception:
        return None


class MppParser(BaseParser):

    def can_parse(self, file_path: str) -> bool:
        return file_path.lower().endswith(".mpp")

    def parse(self, file_path: str) -> ParsedProject:
        ensure_jvm()
        from net.sf.mpxj.reader import UniversalProjectReader

        reader = UniversalProjectReader()
        project_file = reader.read(file_path)
        result = ParsedProject()

        # Project properties
        props = project_file.getProjectProperties()
        if props:
            result.name = str(props.getName() or "")
            result.start = _java_date_to_python(props.getStartDate())
            result.finish = _java_date_to_python(props.getFinishDate())
            result.status_date = _java_date_to_python(props.getStatusDate())

        # Resources
        resource_map: dict[int, str] = {}
        for res in project_file.getResources():
            uid = _safe_int(res.getUniqueID())
            if uid is None:
                continue
            name = str(res.getName() or "")
            resource_map[uid] = name

            parsed_res = ParsedResource(
                uid=uid,
                name=name,
                resource_type=_safe_int(res.getType()),
                max_units=_java_number_to_float(res.getMaxUnits()),
                standard_rate=None,
                cost=_java_number_to_float(res.getCost()),
                actual_cost=_java_number_to_float(res.getActualCost()),
            )
            result.resources.append(parsed_res)

        # Tasks
        total_cost = 0.0
        total_baseline_cost = 0.0
        total_actual_cost = 0.0

        for task in project_file.getTasks():
            uid = _safe_int(task.getUniqueID())
            if uid is None:
                continue

            # Resource names from task assignments
            assignment_resource_names = []
            for ra in task.getResourceAssignments():
                r_uid = _safe_int(ra.getResourceUniqueID())
                if r_uid is not None and r_uid in resource_map:
                    assignment_resource_names.append(resource_map[r_uid])

            # Predecessor UIDs
            pred_uids = []
            predecessors = task.getPredecessors()
            if predecessors:
                for pred in predecessors:
                    target = pred.getTargetTask()
                    if target and target.getUniqueID():
                        pred_uids.append(str(_safe_int(target.getUniqueID())))

            parent_uid = None
            parent = task.getParentTask()
            if parent and parent.getUniqueID():
                parent_uid = _safe_int(parent.getUniqueID())

            cost_val = _java_number_to_float(task.getCost())
            bc_val = _java_number_to_float(task.getBaselineCost())
            ac_val = _java_number_to_float(task.getActualCost())
            is_summary = _java_bool(task.getSummary())

            if not is_summary:
                total_cost += cost_val or 0
                total_baseline_cost += bc_val or 0
                total_actual_cost += ac_val or 0

            parsed_task = ParsedTask(
                uid=uid,
                task_id=_safe_int(task.getID()),
                name=str(task.getName() or ""),
                wbs=str(task.getWBS() or "") if task.getWBS() else None,
                outline_level=_safe_int(task.getOutlineLevel()),
                parent_task_uid=parent_uid,
                start=_java_date_to_python(task.getStart()),
                finish=_java_date_to_python(task.getFinish()),
                baseline_start=_java_date_to_python(task.getBaselineStart()),
                baseline_finish=_java_date_to_python(task.getBaselineFinish()),
                actual_start=_java_date_to_python(task.getActualStart()),
                actual_finish=_java_date_to_python(task.getActualFinish()),
                duration_hours=_java_duration_to_hours(task.getDuration()),
                baseline_duration_hours=_java_duration_to_hours(task.getBaselineDuration()),
                actual_duration_hours=_java_duration_to_hours(task.getActualDuration()),
                remaining_duration_hours=_java_duration_to_hours(task.getRemainingDuration()),
                percent_complete=_java_number_to_float(task.getPercentageComplete()),
                physical_percent_complete=_java_number_to_float(task.getPhysicalPercentComplete()),
                cost=cost_val,
                baseline_cost=bc_val,
                actual_cost=ac_val,
                remaining_cost=_java_number_to_float(task.getRemainingCost()),
                fixed_cost=_java_number_to_float(task.getFixedCost()),
                bcws=_java_number_to_float(task.getBCWS()),
                bcwp=_java_number_to_float(task.getBCWP()),
                acwp=_java_number_to_float(task.getACWP()),
                critical=_java_bool(task.getCritical()),
                milestone=_java_bool(task.getMilestone()),
                summary=is_summary,
                is_null=_java_bool(task.getNull()),
                free_slack_hours=_java_duration_to_hours(task.getFreeSlack()),
                total_slack_hours=_java_duration_to_hours(task.getTotalSlack()),
                resource_names=", ".join(assignment_resource_names) if assignment_resource_names else None,
                predecessor_uids=",".join(pred_uids) if pred_uids else None,
                notes=str(task.getNotes() or "") if task.getNotes() else None,
            )
            result.tasks.append(parsed_task)

        result.cost = total_cost
        result.baseline_cost = total_baseline_cost
        result.actual_cost = total_actual_cost

        # Assignments
        for ra in project_file.getResourceAssignments():
            uid = _safe_int(ra.getUniqueID())
            if uid is None:
                continue
            result.assignments.append(ParsedAssignment(
                uid=uid,
                task_uid=_safe_int(ra.getTaskUniqueID()) or 0,
                resource_uid=_safe_int(ra.getResourceUniqueID()) or 0,
                work_hours=_java_duration_to_hours(ra.getWork()),
                actual_work_hours=_java_duration_to_hours(ra.getActualWork()),
                baseline_work_hours=_java_duration_to_hours(ra.getBaselineWork()),
                remaining_work_hours=_java_duration_to_hours(ra.getRemainingWork()),
                cost=_java_number_to_float(ra.getCost()),
                actual_cost=_java_number_to_float(ra.getActualCost()),
                baseline_cost=_java_number_to_float(ra.getBaselineCost()),
                start=_java_date_to_python(ra.getStart()),
                finish=_java_date_to_python(ra.getFinish()),
                actual_start=_java_date_to_python(ra.getActualStart()),
                actual_finish=_java_date_to_python(ra.getActualFinish()),
            ))

        return result
