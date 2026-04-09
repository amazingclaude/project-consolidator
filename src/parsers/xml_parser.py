import re
from datetime import datetime
from lxml import etree
from .base_parser import (
    BaseParser, ParsedProject, ParsedTask, ParsedResource, ParsedAssignment,
)

NS = {"ms": "http://schemas.microsoft.com/project"}


def _detect_namespace(root) -> dict:
    """Detect the actual namespace from the root element."""
    nsmap = root.nsmap
    if None in nsmap:
        return {"ms": nsmap[None]}
    for prefix, uri in nsmap.items():
        if "microsoft.com/project" in uri:
            return {"ms": uri}
    return NS


def _text(element, xpath: str, ns: dict) -> str | None:
    found = element.xpath(xpath, namespaces=ns)
    if found and found[0].text:
        return found[0].text.strip()
    return None


def _float(element, xpath: str, ns: dict) -> float | None:
    val = _text(element, xpath, ns)
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _int(element, xpath: str, ns: dict) -> int | None:
    val = _text(element, xpath, ns)
    if val is None:
        return None
    try:
        return int(val)
    except ValueError:
        return None


def _bool(element, xpath: str, ns: dict) -> bool | None:
    val = _text(element, xpath, ns)
    if val is None:
        return None
    return val.lower() in ("1", "true")


def _datetime(element, xpath: str, ns: dict) -> datetime | None:
    val = _text(element, xpath, ns)
    if val is None:
        return None
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        return None


_DURATION_RE = re.compile(
    r"P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?"
)


def _duration_to_hours(element, xpath: str, ns: dict) -> float | None:
    val = _text(element, xpath, ns)
    if val is None:
        return None
    match = _DURATION_RE.match(val)
    if not match:
        return None
    days = float(match.group(1) or 0)
    hours = float(match.group(2) or 0)
    minutes = float(match.group(3) or 0)
    seconds = float(match.group(4) or 0)
    return days * 8.0 + hours + minutes / 60.0 + seconds / 3600.0


class XmlParser(BaseParser):

    def can_parse(self, file_path: str) -> bool:
        return file_path.lower().endswith(".xml")

    def parse(self, file_path: str) -> ParsedProject:
        parser = etree.XMLParser(resolve_entities=False, no_network=True)
        tree = etree.parse(file_path, parser)
        root = tree.getroot()
        ns = _detect_namespace(root)

        result = ParsedProject()
        result.name = _text(root, "ms:Name", ns) or ""
        result.start = _datetime(root, "ms:StartDate", ns)
        result.finish = _datetime(root, "ms:FinishDate", ns)
        result.status_date = _datetime(root, "ms:StatusDate", ns)

        # Resources
        resource_map: dict[int, str] = {}
        for res_elem in root.xpath("ms:Resources/ms:Resource", namespaces=ns):
            uid = _int(res_elem, "ms:UID", ns)
            if uid is None:
                continue
            name = _text(res_elem, "ms:Name", ns)
            resource_map[uid] = name or ""

            result.resources.append(ParsedResource(
                uid=uid,
                name=name,
                resource_type=_int(res_elem, "ms:Type", ns),
                max_units=_float(res_elem, "ms:MaxUnits", ns),
                standard_rate=_float(res_elem, "ms:StandardRate", ns),
                overtime_rate=_float(res_elem, "ms:OvertimeRate", ns),
                cost=_float(res_elem, "ms:Cost", ns),
                actual_cost=_float(res_elem, "ms:ActualCost", ns),
            ))

        # Assignments — build task_uid -> resource_uids map
        assignment_task_map: dict[int, list[int]] = {}
        for asgn_elem in root.xpath("ms:Assignments/ms:Assignment", namespaces=ns):
            uid = _int(asgn_elem, "ms:UID", ns)
            t_uid = _int(asgn_elem, "ms:TaskUID", ns)
            r_uid = _int(asgn_elem, "ms:ResourceUID", ns)
            if uid is None or t_uid is None:
                continue
            assignment_task_map.setdefault(t_uid, []).append(r_uid or 0)

            result.assignments.append(ParsedAssignment(
                uid=uid,
                task_uid=t_uid,
                resource_uid=r_uid or 0,
                work_hours=_duration_to_hours(asgn_elem, "ms:Work", ns),
                actual_work_hours=_duration_to_hours(asgn_elem, "ms:ActualWork", ns),
                baseline_work_hours=_duration_to_hours(asgn_elem, "ms:BaselineWork", ns),
                remaining_work_hours=_duration_to_hours(asgn_elem, "ms:RemainingWork", ns),
                cost=_float(asgn_elem, "ms:Cost", ns),
                actual_cost=_float(asgn_elem, "ms:ActualCost", ns),
                baseline_cost=_float(asgn_elem, "ms:BaselineCost", ns),
                start=_datetime(asgn_elem, "ms:Start", ns),
                finish=_datetime(asgn_elem, "ms:Finish", ns),
                actual_start=_datetime(asgn_elem, "ms:ActualStart", ns),
                actual_finish=_datetime(asgn_elem, "ms:ActualFinish", ns),
            ))

        # Tasks
        total_cost = 0.0
        total_baseline_cost = 0.0
        total_actual_cost = 0.0

        for task_elem in root.xpath("ms:Tasks/ms:Task", namespaces=ns):
            uid = _int(task_elem, "ms:UID", ns)
            if uid is None:
                continue

            # Baseline 0 (primary baseline) from nested <Baseline> elements
            bl_start = None
            bl_finish = None
            bl_duration = None
            bl_cost = None
            for bl in task_elem.xpath("ms:Baseline", namespaces=ns):
                bl_num = _int(bl, "ms:Number", ns)
                if bl_num == 0:
                    bl_start = _datetime(bl, "ms:Start", ns)
                    bl_finish = _datetime(bl, "ms:Finish", ns)
                    bl_duration = _duration_to_hours(bl, "ms:Duration", ns)
                    bl_cost = _float(bl, "ms:Cost", ns)
                    break

            # Predecessor UIDs
            pred_uids = []
            for pred in task_elem.xpath("ms:PredecessorLink", namespaces=ns):
                p_uid = _int(pred, "ms:PredecessorUID", ns)
                if p_uid is not None:
                    pred_uids.append(str(p_uid))

            # Resource names from assignments
            r_names = []
            if uid in assignment_task_map:
                for r_uid in assignment_task_map[uid]:
                    if r_uid in resource_map:
                        r_names.append(resource_map[r_uid])

            is_summary = _bool(task_elem, "ms:Summary", ns)
            cost_val = _float(task_elem, "ms:Cost", ns)
            ac_val = _float(task_elem, "ms:ActualCost", ns)

            if not is_summary:
                total_cost += cost_val or 0
                total_baseline_cost += bl_cost or 0
                total_actual_cost += ac_val or 0

            result.tasks.append(ParsedTask(
                uid=uid,
                task_id=_int(task_elem, "ms:ID", ns),
                name=_text(task_elem, "ms:Name", ns) or "",
                wbs=_text(task_elem, "ms:WBS", ns),
                outline_level=_int(task_elem, "ms:OutlineLevel", ns),
                start=_datetime(task_elem, "ms:Start", ns),
                finish=_datetime(task_elem, "ms:Finish", ns),
                baseline_start=bl_start,
                baseline_finish=bl_finish,
                actual_start=_datetime(task_elem, "ms:ActualStart", ns),
                actual_finish=_datetime(task_elem, "ms:ActualFinish", ns),
                duration_hours=_duration_to_hours(task_elem, "ms:Duration", ns),
                baseline_duration_hours=bl_duration,
                actual_duration_hours=_duration_to_hours(task_elem, "ms:ActualDuration", ns),
                remaining_duration_hours=_duration_to_hours(task_elem, "ms:RemainingDuration", ns),
                percent_complete=_float(task_elem, "ms:PercentComplete", ns),
                physical_percent_complete=_float(task_elem, "ms:PhysicalPercentComplete", ns),
                cost=cost_val,
                baseline_cost=bl_cost,
                actual_cost=ac_val,
                remaining_cost=_float(task_elem, "ms:RemainingCost", ns),
                fixed_cost=_float(task_elem, "ms:FixedCost", ns),
                bcws=_float(task_elem, "ms:BCWS", ns),
                bcwp=_float(task_elem, "ms:BCWP", ns),
                acwp=_float(task_elem, "ms:ACWP", ns),
                critical=_bool(task_elem, "ms:Critical", ns),
                milestone=_bool(task_elem, "ms:Milestone", ns),
                summary=is_summary,
                is_null=_bool(task_elem, "ms:IsNull", ns),
                free_slack_hours=_duration_to_hours(task_elem, "ms:FreeSlack", ns),
                total_slack_hours=_duration_to_hours(task_elem, "ms:TotalSlack", ns),
                resource_names=", ".join(r_names) if r_names else None,
                predecessor_uids=",".join(pred_uids) if pred_uids else None,
                notes=_text(task_elem, "ms:Notes", ns),
            ))

        result.cost = total_cost
        result.baseline_cost = total_baseline_cost
        result.actual_cost = total_actual_cost

        return result
