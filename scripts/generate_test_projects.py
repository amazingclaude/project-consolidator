#!/usr/bin/env python3
"""
Generate 50 realistic MS Project XML files for Curbside EV Charger installations.

Projects span all lifecycle stages:
  - Completed (with historical deviations)
  - In-progress (various % complete, some troubled)
  - Early-stage planning (baseline only, minimal actuals)

Includes realistic deviations & anomalies:
  - Schedule slippage (permit delays, weather, supply chain)
  - Cost overruns (material escalation, scope creep, rework)
  - Duration overruns
  - Milestone slippage
  - CPI/SPI degradation
  - Missing baselines (planning stage)
  - Orphaned tasks, missing assignments
"""

import os
import random
import math
from datetime import datetime, timedelta
from typing import Optional

# ────────────────────────────────────────────
# Project templates & configuration
# ────────────────────────────────────────────

BOROUGHS = [
    "Westminster", "Camden", "Islington", "Hackney", "Tower Hamlets",
    "Southwark", "Lambeth", "Wandsworth", "Hammersmith", "Kensington",
    "Barnet", "Ealing", "Brent", "Haringey", "Lewisham",
    "Greenwich", "Newham", "Redbridge", "Croydon", "Bromley",
    "Hounslow", "Richmond", "Kingston", "Merton", "Sutton",
]

STREET_TYPES = [
    "High Street", "Station Road", "Church Lane", "Park Avenue",
    "Victoria Road", "King Street", "Queen's Road", "Bridge Street",
    "Market Square", "Green Lane", "Mill Road", "Manor Way",
    "Elm Grove", "Oak Drive", "Cedar Close",
]

CHARGER_TYPES = [
    ("7kW AC Bollard", 7),
    ("22kW AC Pedestal", 22),
    ("50kW DC Rapid", 50),
    ("150kW DC Ultra-Rapid", 150),
]

# Resources used across projects
RESOURCE_POOL = [
    {"uid": 1, "name": "Project Manager", "type": 1, "rate": 85.0, "ot_rate": 127.50},
    {"uid": 2, "name": "Civil Engineer", "type": 1, "rate": 75.0, "ot_rate": 112.50},
    {"uid": 3, "name": "Electrical Engineer", "type": 1, "rate": 78.0, "ot_rate": 117.00},
    {"uid": 4, "name": "Site Surveyor", "type": 1, "rate": 55.0, "ot_rate": 82.50},
    {"uid": 5, "name": "Permit Coordinator", "type": 1, "rate": 50.0, "ot_rate": 75.00},
    {"uid": 6, "name": "Groundworks Crew", "type": 1, "rate": 45.0, "ot_rate": 67.50},
    {"uid": 7, "name": "Electrical Contractor", "type": 1, "rate": 65.0, "ot_rate": 97.50},
    {"uid": 8, "name": "Network Commissioning Tech", "type": 1, "rate": 60.0, "ot_rate": 90.00},
    {"uid": 9, "name": "Traffic Management Officer", "type": 1, "rate": 48.0, "ot_rate": 72.00},
    {"uid": 10, "name": "QA Inspector", "type": 1, "rate": 58.0, "ot_rate": 87.00},
    {"uid": 11, "name": "Health & Safety Officer", "type": 1, "rate": 52.0, "ot_rate": 78.00},
    {"uid": 12, "name": "DNO Liaison", "type": 1, "rate": 70.0, "ot_rate": 105.00},
]

# Standard task template for curbside EV charger installation
# (name, baseline_days, is_milestone, is_critical, resource_uids, outline_level)
TASK_TEMPLATE = [
    # Phase 0: Summary
    ("Curbside EV Charger Installation", 0, False, False, [], 0, True),  # summary

    # Phase 1: Initiation & Planning
    ("Initiation & Planning", 0, False, False, [], 1, True),  # summary
    ("Site Identification & Assessment", 5, False, True, [1, 4], 2, False),
    ("Feasibility Study", 8, False, True, [2, 4], 2, False),
    ("Stakeholder Consultation", 10, False, False, [1, 5], 2, False),
    ("DNO Pre-Application", 5, False, True, [3, 12], 2, False),
    ("Planning Approval Milestone", 0, True, True, [1], 2, False),

    # Phase 2: Design
    ("Detailed Design", 0, False, False, [], 1, True),  # summary
    ("Electrical Design & Load Calculations", 10, False, True, [3], 2, False),
    ("Civil & Structural Design", 8, False, True, [2], 2, False),
    ("Traffic Management Plan", 5, False, False, [9], 2, False),
    ("Design Review & Sign-off", 3, False, True, [1, 2, 3], 2, False),
    ("Design Complete Milestone", 0, True, True, [1], 2, False),

    # Phase 3: Procurement & Permits
    ("Procurement & Permits", 0, False, False, [], 1, True),  # summary
    ("Charger Equipment Procurement", 20, False, True, [1], 2, False),
    ("Switchgear & Cable Procurement", 15, False, True, [3], 2, False),
    ("Highway Permit Application (S50/S171)", 15, False, True, [5], 2, False),
    ("DNO Connection Agreement", 20, False, True, [3, 12], 2, False),
    ("Permits Secured Milestone", 0, True, True, [5], 2, False),

    # Phase 4: Construction
    ("Construction & Installation", 0, False, False, [], 1, True),  # summary
    ("Traffic Management Setup", 2, False, True, [9, 6], 2, False),
    ("Excavation & Trenching", 5, False, True, [6], 2, False),
    ("Cable Ducting Installation", 4, False, True, [6, 7], 2, False),
    ("Foundation & Bollard Base", 3, False, True, [6], 2, False),
    ("Electrical Cabling & Termination", 5, False, True, [7], 2, False),
    ("Charger Unit Mounting", 2, False, True, [7, 8], 2, False),
    ("Reinstatement & Making Good", 3, False, False, [6], 2, False),
    ("Construction Complete Milestone", 0, True, True, [1], 2, False),

    # Phase 5: Commissioning & Handover
    ("Commissioning & Handover", 0, False, False, [], 1, True),  # summary
    ("Electrical Testing & Certification", 3, False, True, [7, 10], 2, False),
    ("Network Connectivity & Software Config", 2, False, True, [8], 2, False),
    ("DNO Energisation", 5, False, True, [3, 12], 2, False),
    ("User Acceptance Testing", 2, False, False, [1, 10], 2, False),
    ("Health & Safety Sign-off", 1, False, True, [11], 2, False),
    ("As-Built Documentation", 3, False, False, [2, 3], 2, False),
    ("Project Handover Milestone", 0, True, True, [1], 2, False),
]

# ────────────────────────────────────────────
# Project profiles — different stages & health
# ────────────────────────────────────────────

def make_project_profiles():
    """Return 50 project profiles with varying stages and anomaly types."""
    profiles = []

    # --- COMPLETED PROJECTS (15) ---
    # 5 on-time, on-budget
    for i in range(5):
        profiles.append({
            "stage": "completed",
            "health": "green",
            "schedule_drift_factor": random.uniform(-0.05, 0.05),
            "cost_drift_factor": random.uniform(-0.05, 0.08),
            "anomalies": [],
            "start_offset_days": random.randint(-400, -250),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(2, 6),
        })

    # 5 completed with moderate issues
    for i in range(5):
        anomalies = random.sample([
            "permit_delay", "weather_delay", "minor_cost_overrun",
            "resource_conflict", "design_rework"
        ], k=random.randint(1, 3))
        profiles.append({
            "stage": "completed",
            "health": "amber",
            "schedule_drift_factor": random.uniform(0.10, 0.30),
            "cost_drift_factor": random.uniform(0.10, 0.25),
            "anomalies": anomalies,
            "start_offset_days": random.randint(-350, -200),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(2, 8),
        })

    # 5 completed with serious overruns
    for i in range(5):
        anomalies = random.sample([
            "permit_delay", "supply_chain_crisis", "major_cost_overrun",
            "scope_creep", "dno_delay", "ground_contamination",
            "utility_strike", "design_rework"
        ], k=random.randint(2, 4))
        profiles.append({
            "stage": "completed",
            "health": "red",
            "schedule_drift_factor": random.uniform(0.30, 0.60),
            "cost_drift_factor": random.uniform(0.25, 0.50),
            "anomalies": anomalies,
            "start_offset_days": random.randint(-400, -220),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(4, 12),
        })

    # --- IN-PROGRESS PROJECTS (20) ---
    # 5 on-track, early construction
    for i in range(5):
        profiles.append({
            "stage": "in_progress",
            "progress_pct": random.uniform(0.40, 0.65),
            "health": "green",
            "schedule_drift_factor": random.uniform(-0.03, 0.05),
            "cost_drift_factor": random.uniform(-0.03, 0.05),
            "anomalies": [],
            "start_offset_days": random.randint(-120, -80),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(2, 8),
        })

    # 5 in-progress, slipping
    for i in range(5):
        anomalies = random.sample([
            "permit_delay", "resource_conflict", "weather_delay",
            "material_shortage", "design_rework"
        ], k=random.randint(1, 3))
        profiles.append({
            "stage": "in_progress",
            "progress_pct": random.uniform(0.30, 0.55),
            "health": "amber",
            "schedule_drift_factor": random.uniform(0.15, 0.35),
            "cost_drift_factor": random.uniform(0.10, 0.20),
            "anomalies": anomalies,
            "start_offset_days": random.randint(-150, -90),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(3, 10),
        })

    # 5 in-progress, in trouble (red)
    for i in range(5):
        anomalies = random.sample([
            "permit_delay", "supply_chain_crisis", "major_cost_overrun",
            "scope_creep", "dno_delay", "utility_strike",
            "contractor_dispute", "design_rework"
        ], k=random.randint(2, 4))
        profiles.append({
            "stage": "in_progress",
            "progress_pct": random.uniform(0.20, 0.50),
            "health": "red",
            "schedule_drift_factor": random.uniform(0.35, 0.70),
            "cost_drift_factor": random.uniform(0.25, 0.55),
            "anomalies": anomalies,
            "start_offset_days": random.randint(-180, -100),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(4, 15),
        })

    # 5 in-progress, very early (design/procurement phase)
    for i in range(5):
        anomalies_pool = ["permit_delay", "dno_delay", "design_rework"]
        anomalies = random.sample(anomalies_pool, k=random.randint(0, 1))
        profiles.append({
            "stage": "in_progress",
            "progress_pct": random.uniform(0.10, 0.30),
            "health": random.choice(["green", "amber"]),
            "schedule_drift_factor": random.uniform(0.0, 0.15),
            "cost_drift_factor": random.uniform(0.0, 0.10),
            "anomalies": anomalies,
            "start_offset_days": random.randint(-60, -30),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(2, 6),
        })

    # --- PLANNING STAGE PROJECTS (15) ---
    # 8 early planning (no baselines, minimal data)
    for i in range(8):
        profiles.append({
            "stage": "planning",
            "health": "none",
            "schedule_drift_factor": 0.0,
            "cost_drift_factor": 0.0,
            "anomalies": [],
            "start_offset_days": random.randint(10, 60),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(2, 10),
            "has_baseline": False,
        })

    # 4 planning with baselines set
    for i in range(4):
        profiles.append({
            "stage": "planning",
            "health": "none",
            "schedule_drift_factor": 0.0,
            "cost_drift_factor": 0.0,
            "anomalies": [],
            "start_offset_days": random.randint(15, 90),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(3, 8),
            "has_baseline": True,
        })

    # 3 planning with anomalies (scope uncertainty, missing info)
    for i in range(3):
        profiles.append({
            "stage": "planning",
            "health": "none",
            "schedule_drift_factor": 0.0,
            "cost_drift_factor": 0.0,
            "anomalies": random.sample(["missing_assignments", "orphaned_tasks", "no_costs"], k=random.randint(1, 2)),
            "start_offset_days": random.randint(20, 75),
            "charger_type": random.choice(CHARGER_TYPES),
            "num_chargers": random.randint(2, 6),
            "has_baseline": random.choice([True, False]),
        })

    random.shuffle(profiles)
    return profiles


# ────────────────────────────────────────────
# XML generation helpers
# ────────────────────────────────────────────

NS = "http://schemas.microsoft.com/project"

def fmt_date(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%S")

def fmt_duration(hours: float) -> str:
    h = int(hours)
    m = int((hours - h) * 60)
    return f"PT{h}H{m}M0S"

def hours_to_workdays(hours: float) -> float:
    return hours / 8.0

def workdays_to_hours(days: float) -> float:
    return days * 8.0

def add_workdays(start: datetime, days: int) -> datetime:
    """Add workdays (skip weekends)."""
    current = start
    added = 0
    while added < abs(days):
        current += timedelta(days=1 if days >= 0 else -1)
        if current.weekday() < 5:  # Mon-Fri
            added += 1
    return current

def compute_anomaly_effects(anomalies, task_name, task_idx, profile):
    """Return (extra_days, cost_multiplier) based on anomalies for a specific task."""
    extra_days = 0
    cost_mult = 1.0

    for a in anomalies:
        if a == "permit_delay" and "Permit" in task_name:
            extra_days += random.randint(10, 40)
            cost_mult *= random.uniform(1.0, 1.05)
        elif a == "weather_delay" and any(k in task_name for k in ["Excavation", "Trenching", "Foundation", "Traffic Management Setup"]):
            extra_days += random.randint(3, 15)
            cost_mult *= random.uniform(1.05, 1.15)
        elif a == "supply_chain_crisis" and "Procurement" in task_name:
            extra_days += random.randint(15, 45)
            cost_mult *= random.uniform(1.15, 1.40)
        elif a == "minor_cost_overrun":
            cost_mult *= random.uniform(1.05, 1.15)
        elif a == "major_cost_overrun":
            cost_mult *= random.uniform(1.15, 1.45)
        elif a == "scope_creep" and any(k in task_name for k in ["Design", "Cable", "Charger"]):
            extra_days += random.randint(3, 12)
            cost_mult *= random.uniform(1.10, 1.30)
        elif a == "dno_delay" and "DNO" in task_name:
            extra_days += random.randint(10, 35)
            cost_mult *= random.uniform(1.0, 1.10)
        elif a == "ground_contamination" and "Excavation" in task_name:
            extra_days += random.randint(5, 20)
            cost_mult *= random.uniform(1.20, 1.50)
        elif a == "utility_strike" and "Excavation" in task_name:
            extra_days += random.randint(3, 10)
            cost_mult *= random.uniform(1.10, 1.35)
        elif a == "design_rework" and "Design" in task_name:
            extra_days += random.randint(5, 15)
            cost_mult *= random.uniform(1.10, 1.25)
        elif a == "resource_conflict":
            extra_days += random.randint(2, 8)
            cost_mult *= random.uniform(1.02, 1.10)
        elif a == "material_shortage" and any(k in task_name for k in ["Cable", "Charger", "Switchgear"]):
            extra_days += random.randint(7, 25)
            cost_mult *= random.uniform(1.05, 1.20)
        elif a == "contractor_dispute" and any(k in task_name for k in ["Construction", "Electrical", "Groundworks"]):
            extra_days += random.randint(5, 20)
            cost_mult *= random.uniform(1.10, 1.25)

    return extra_days, cost_mult


def generate_project_xml(project_idx: int, profile: dict) -> str:
    """Generate a complete MS Project MSPDI XML string."""
    random.seed(42 + project_idx)  # reproducible per project

    borough = BOROUGHS[project_idx % len(BOROUGHS)]
    street = random.choice(STREET_TYPES)
    charger_name, charger_kw = profile["charger_type"]
    num_chargers = profile["num_chargers"]
    project_name = f"{borough} - {street} - {num_chargers}x {charger_name} Installation"

    base_date = datetime(2024, 1, 15, 8, 0, 0)
    project_start = base_date + timedelta(days=profile["start_offset_days"])
    # Ensure start is a weekday
    while project_start.weekday() >= 5:
        project_start += timedelta(days=1)

    stage = profile["stage"]
    health = profile["health"]
    anomalies = profile["anomalies"]
    schedule_drift = profile["schedule_drift_factor"]
    cost_drift = profile["cost_drift_factor"]
    has_baseline = profile.get("has_baseline", stage != "planning" or profile.get("has_baseline", False))
    progress_pct_target = profile.get("progress_pct", 1.0 if stage == "completed" else 0.0)

    # Select resources (subset for smaller projects)
    if num_chargers <= 3:
        project_resources = RESOURCE_POOL[:8]
    elif num_chargers <= 6:
        project_resources = RESOURCE_POOL[:10]
    else:
        project_resources = RESOURCE_POOL[:]

    # ──── Build task schedule ────
    tasks = []
    task_uid = 0
    current_date = project_start
    total_tasks = len(TASK_TEMPLATE)

    # Scale durations by charger count
    scale_factor = 1.0 + (num_chargers - 2) * 0.08  # more chargers = longer

    for t_idx, (t_name, t_base_days, t_milestone, t_critical, t_res_uids, t_outline, t_summary) in enumerate(TASK_TEMPLATE):
        task_uid += 1

        if t_summary:
            # Summary tasks — we'll fill in dates later
            tasks.append({
                "uid": task_uid,
                "id": task_uid,
                "name": t_name if t_idx > 0 else project_name,
                "wbs": str(t_idx + 1),
                "outline_level": t_outline,
                "summary": True,
                "milestone": False,
                "critical": False,
                "is_null": False,
                "resource_uids": [],
                "notes": "",
            })
            continue

        # Calculate baseline duration
        scaled_days = max(1, int(t_base_days * scale_factor))
        baseline_duration_hours = workdays_to_hours(scaled_days)

        # Baseline schedule
        baseline_start = current_date
        baseline_finish = add_workdays(baseline_start, max(scaled_days, 1)) if not t_milestone else baseline_start

        # Calculate actual schedule with drift & anomalies
        anomaly_extra_days, anomaly_cost_mult = compute_anomaly_effects(anomalies, t_name, t_idx, profile)
        drift_extra_days = int(scaled_days * schedule_drift * random.uniform(0.3, 1.5))
        total_extra_days = max(0, drift_extra_days + anomaly_extra_days)

        actual_duration_days = scaled_days + total_extra_days
        actual_duration_hours = workdays_to_hours(actual_duration_days)

        # Planned (current) schedule — reflects latest re-plan
        planned_start = baseline_start + timedelta(days=random.randint(0, max(0, total_extra_days // 2)))
        while planned_start.weekday() >= 5:
            planned_start += timedelta(days=1)
        planned_finish = add_workdays(planned_start, actual_duration_days) if not t_milestone else planned_start
        planned_duration_hours = workdays_to_hours(actual_duration_days)

        # Cost calculations
        base_cost_per_charger = charger_kw * random.uniform(80, 150)  # cost scales with power
        base_task_cost = base_cost_per_charger * num_chargers * (scaled_days / 120.0)
        base_task_cost = max(500, base_task_cost)  # minimum cost per task

        baseline_cost = round(base_task_cost, 2)
        planned_cost = round(base_task_cost * (1 + cost_drift) * anomaly_cost_mult, 2)

        # Determine task progress based on project stage
        task_progress_ratio = t_idx / total_tasks  # position in project

        if stage == "completed":
            pct_complete = 100.0
            actual_start = planned_start
            actual_finish = planned_finish
            actual_cost = planned_cost
            actual_dur = actual_duration_hours
            remaining_cost = 0.0
            remaining_dur = 0.0
        elif stage == "in_progress":
            if task_progress_ratio <= progress_pct_target:
                # Task is complete
                pct_complete = 100.0
                actual_start = planned_start
                actual_finish = planned_finish
                actual_cost = planned_cost
                actual_dur = actual_duration_hours
                remaining_cost = 0.0
                remaining_dur = 0.0
            elif task_progress_ratio <= progress_pct_target + 0.08:
                # Task is in-progress
                pct_complete = round(random.uniform(15, 85), 0)
                actual_start = planned_start
                actual_finish = None
                actual_cost = round(planned_cost * (pct_complete / 100.0) * random.uniform(0.9, 1.2), 2)
                actual_dur = actual_duration_hours * (pct_complete / 100.0)
                remaining_cost = round(planned_cost - actual_cost, 2)
                remaining_dur = actual_duration_hours - actual_dur
            else:
                # Task not started
                pct_complete = 0.0
                actual_start = None
                actual_finish = None
                actual_cost = 0.0
                actual_dur = 0.0
                remaining_cost = planned_cost
                remaining_dur = planned_duration_hours
        else:
            # Planning stage
            pct_complete = 0.0
            actual_start = None
            actual_finish = None
            actual_cost = 0.0
            actual_dur = 0.0
            remaining_cost = planned_cost if has_baseline else 0.0
            remaining_dur = planned_duration_hours

        # EVM metrics (only for tasks with progress)
        bcws = round(baseline_cost * min(1.0, task_progress_ratio / max(0.01, progress_pct_target)), 2) if has_baseline else 0.0
        bcwp = round(baseline_cost * (pct_complete / 100.0), 2) if has_baseline else 0.0
        acwp = actual_cost

        # Slack
        if t_critical:
            free_slack = 0.0
            total_slack = 0.0
        else:
            free_slack = random.uniform(0, 40)
            total_slack = free_slack + random.uniform(0, 24)

        # Handle anomalies for data quality
        skip_assignments = "missing_assignments" in anomalies and random.random() < 0.4
        skip_costs = "no_costs" in anomalies and random.random() < 0.5
        is_orphaned = "orphaned_tasks" in anomalies and random.random() < 0.15

        if skip_costs:
            planned_cost = 0.0
            baseline_cost = 0.0
            actual_cost = 0.0
            remaining_cost = 0.0

        task_resources = [] if skip_assignments or is_orphaned else t_res_uids

        # Notes for tasks with issues
        notes = ""
        if anomaly_extra_days > 5 and pct_complete > 0:
            note_reasons = {
                "permit_delay": "Permit approval delayed by local authority review backlog.",
                "weather_delay": "Adverse weather conditions halted site works.",
                "supply_chain_crisis": "Charger equipment delivery delayed - supplier backlog.",
                "dno_delay": "DNO connection timeline extended beyond estimate.",
                "ground_contamination": "Contaminated ground discovered - remediation required.",
                "utility_strike": "Uncharted utility strike during excavation.",
                "design_rework": "Design amendments required following review.",
                "contractor_dispute": "Contractor performance issues - schedule impact.",
                "material_shortage": "Key materials on extended lead time.",
            }
            for a in anomalies:
                if a in note_reasons:
                    notes += note_reasons[a] + " "

        tasks.append({
            "uid": task_uid,
            "id": task_uid,
            "name": t_name,
            "wbs": f"1.{t_idx}",
            "outline_level": t_outline,
            "summary": False,
            "milestone": t_milestone,
            "critical": t_critical,
            "is_null": False,
            "baseline_start": baseline_start if has_baseline else None,
            "baseline_finish": baseline_finish if has_baseline else None,
            "baseline_duration_hours": baseline_duration_hours if has_baseline else None,
            "baseline_cost": baseline_cost if has_baseline else None,
            "start": planned_start,
            "finish": planned_finish,
            "duration_hours": planned_duration_hours if not t_milestone else 0,
            "actual_start": actual_start,
            "actual_finish": actual_finish,
            "actual_duration_hours": actual_dur,
            "remaining_duration_hours": remaining_dur,
            "pct_complete": pct_complete,
            "cost": planned_cost,
            "actual_cost": actual_cost,
            "remaining_cost": remaining_cost,
            "fixed_cost": round(planned_cost * random.uniform(0.1, 0.3), 2) if planned_cost > 0 else 0.0,
            "bcws": bcws,
            "bcwp": bcwp,
            "acwp": acwp,
            "free_slack": free_slack,
            "total_slack": total_slack,
            "resource_uids": task_resources,
            "notes": notes.strip(),
            "predecessor_uid": tasks[-1]["uid"] if len(tasks) > 0 and not tasks[-1].get("summary", False) else None,
        })

        # Advance date for next task
        if not t_milestone:
            current_date = planned_finish + timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date += timedelta(days=1)

    # Fill in summary task dates
    non_summary = [t for t in tasks if not t.get("summary", False)]
    if non_summary:
        proj_finish = max(t["finish"] for t in non_summary if t.get("finish"))
        proj_actual_finish = None
        if stage == "completed":
            actual_finishes = [t["actual_finish"] for t in non_summary if t.get("actual_finish")]
            proj_actual_finish = max(actual_finishes) if actual_finishes else proj_finish

        for t in tasks:
            if t.get("summary"):
                t["start"] = project_start
                t["finish"] = proj_finish
                t["actual_start"] = project_start if stage != "planning" else None
                t["actual_finish"] = proj_actual_finish if stage == "completed" else None
    else:
        proj_finish = project_start + timedelta(days=120)

    # Status date
    if stage == "completed":
        status_date = proj_actual_finish or proj_finish
    elif stage == "in_progress":
        status_date = datetime.now().replace(hour=17, minute=0, second=0, microsecond=0)
    else:
        status_date = project_start

    # ──── Build assignments ────
    assignments = []
    assign_uid = 0
    for t in tasks:
        if t.get("summary"):
            continue
        for res_uid in t.get("resource_uids", []):
            assign_uid += 1
            work_hours = t.get("duration_hours", 0) or 0
            actual_work = t.get("actual_duration_hours", 0) or 0
            baseline_work = t.get("baseline_duration_hours", work_hours) or work_hours

            # Find resource rate
            res = next((r for r in RESOURCE_POOL if r["uid"] == res_uid), None)
            rate = res["rate"] if res else 60.0

            assignments.append({
                "uid": assign_uid,
                "task_uid": t["uid"],
                "resource_uid": res_uid,
                "work_hours": work_hours,
                "actual_work_hours": actual_work * (t.get("pct_complete", 0) / 100.0),
                "baseline_work_hours": baseline_work if has_baseline else None,
                "remaining_work_hours": max(0, work_hours - actual_work * (t.get("pct_complete", 0) / 100.0)),
                "cost": round(work_hours * rate, 2),
                "actual_cost": round(actual_work * (t.get("pct_complete", 0) / 100.0) * rate, 2),
                "baseline_cost": round(baseline_work * rate, 2) if has_baseline else None,
                "start": t.get("start"),
                "finish": t.get("finish"),
                "actual_start": t.get("actual_start"),
                "actual_finish": t.get("actual_finish"),
            })

    # ──── Aggregate project costs ────
    real_tasks = [t for t in tasks if not t.get("summary") and not t.get("is_null")]
    total_cost = sum(t.get("cost", 0) or 0 for t in real_tasks)
    total_baseline_cost = sum(t.get("baseline_cost", 0) or 0 for t in real_tasks)
    total_actual_cost = sum(t.get("actual_cost", 0) or 0 for t in real_tasks)

    # ──── Render XML ────
    xml = render_xml(
        project_name=project_name,
        project_start=project_start,
        project_finish=proj_finish,
        status_date=status_date,
        tasks=tasks,
        resources=project_resources,
        assignments=assignments,
        has_baseline=has_baseline,
    )

    return project_name, xml


def render_xml(project_name, project_start, project_finish, status_date,
               tasks, resources, assignments, has_baseline):
    """Render the MSPDI XML document."""
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(f'<Project xmlns="{NS}">')
    lines.append(f'  <Name>{esc(project_name)}</Name>')
    lines.append(f'  <StartDate>{fmt_date(project_start)}</StartDate>')
    lines.append(f'  <FinishDate>{fmt_date(project_finish)}</FinishDate>')
    lines.append(f'  <StatusDate>{fmt_date(status_date)}</StatusDate>')

    # Resources
    lines.append('  <Resources>')
    for r in resources:
        lines.append('    <Resource>')
        lines.append(f'      <UID>{r["uid"]}</UID>')
        lines.append(f'      <Name>{esc(r["name"])}</Name>')
        lines.append(f'      <Type>{r["type"]}</Type>')
        lines.append(f'      <MaxUnits>1.0</MaxUnits>')
        lines.append(f'      <StandardRate>{r["rate"]}</StandardRate>')
        lines.append(f'      <OvertimeRate>{r["ot_rate"]}</OvertimeRate>')
        lines.append(f'      <Cost>0</Cost>')
        lines.append(f'      <ActualCost>0</ActualCost>')
        lines.append('    </Resource>')
    lines.append('  </Resources>')

    # Tasks
    lines.append('  <Tasks>')
    for t in tasks:
        lines.append('    <Task>')
        lines.append(f'      <UID>{t["uid"]}</UID>')
        lines.append(f'      <ID>{t["id"]}</ID>')
        lines.append(f'      <Name>{esc(t["name"])}</Name>')
        lines.append(f'      <WBS>{t.get("wbs", "")}</WBS>')
        lines.append(f'      <OutlineLevel>{t["outline_level"]}</OutlineLevel>')

        is_summary = t.get("summary", False)
        is_milestone = t.get("milestone", False)

        if t.get("start"):
            lines.append(f'      <Start>{fmt_date(t["start"])}</Start>')
        if t.get("finish"):
            lines.append(f'      <Finish>{fmt_date(t["finish"])}</Finish>')

        if not is_summary:
            dur_h = t.get("duration_hours", 0) or 0
            lines.append(f'      <Duration>{fmt_duration(dur_h)}</Duration>')

            if t.get("actual_start"):
                lines.append(f'      <ActualStart>{fmt_date(t["actual_start"])}</ActualStart>')
            if t.get("actual_finish"):
                lines.append(f'      <ActualFinish>{fmt_date(t["actual_finish"])}</ActualFinish>')

            act_dur = t.get("actual_duration_hours", 0) or 0
            lines.append(f'      <ActualDuration>{fmt_duration(act_dur)}</ActualDuration>')

            rem_dur = t.get("remaining_duration_hours", 0) or 0
            lines.append(f'      <RemainingDuration>{fmt_duration(rem_dur)}</RemainingDuration>')

            pct = t.get("pct_complete", 0) or 0
            lines.append(f'      <PercentComplete>{pct}</PercentComplete>')
            lines.append(f'      <PhysicalPercentComplete>{pct}</PhysicalPercentComplete>')

            cost = t.get("cost", 0) or 0
            lines.append(f'      <Cost>{cost}</Cost>')
            act_cost = t.get("actual_cost", 0) or 0
            lines.append(f'      <ActualCost>{act_cost}</ActualCost>')
            rem_cost = t.get("remaining_cost", 0) or 0
            lines.append(f'      <RemainingCost>{rem_cost}</RemainingCost>')
            fixed_cost = t.get("fixed_cost", 0) or 0
            lines.append(f'      <FixedCost>{fixed_cost}</FixedCost>')

            bcws = t.get("bcws", 0) or 0
            bcwp = t.get("bcwp", 0) or 0
            acwp = t.get("acwp", 0) or 0
            lines.append(f'      <BCWS>{bcws}</BCWS>')
            lines.append(f'      <BCWP>{bcwp}</BCWP>')
            lines.append(f'      <ACWP>{acwp}</ACWP>')

            crit = 1 if t.get("critical") else 0
            lines.append(f'      <Critical>{crit}</Critical>')
            ms = 1 if is_milestone else 0
            lines.append(f'      <Milestone>{ms}</Milestone>')
            lines.append(f'      <Summary>0</Summary>')
            lines.append(f'      <IsNull>0</IsNull>')

            fs = t.get("free_slack", 0) or 0
            ts = t.get("total_slack", 0) or 0
            lines.append(f'      <FreeSlack>{fmt_duration(fs)}</FreeSlack>')
            lines.append(f'      <TotalSlack>{fmt_duration(ts)}</TotalSlack>')

            notes = t.get("notes", "")
            if notes:
                lines.append(f'      <Notes>{esc(notes)}</Notes>')

            # Baseline
            if has_baseline and t.get("baseline_start"):
                lines.append('      <Baseline>')
                lines.append('        <Number>0</Number>')
                lines.append(f'        <Start>{fmt_date(t["baseline_start"])}</Start>')
                lines.append(f'        <Finish>{fmt_date(t["baseline_finish"])}</Finish>')
                bl_dur = t.get("baseline_duration_hours", 0) or 0
                lines.append(f'        <Duration>{fmt_duration(bl_dur)}</Duration>')
                bl_cost = t.get("baseline_cost", 0) or 0
                lines.append(f'        <Cost>{bl_cost}</Cost>')
                lines.append('      </Baseline>')

            # Predecessor
            pred = t.get("predecessor_uid")
            if pred:
                lines.append('      <PredecessorLink>')
                lines.append(f'        <PredecessorUID>{pred}</PredecessorUID>')
                lines.append('      </PredecessorLink>')
        else:
            # Summary task
            lines.append(f'      <Summary>1</Summary>')
            lines.append(f'      <Milestone>0</Milestone>')
            lines.append(f'      <IsNull>0</IsNull>')
            lines.append(f'      <Critical>0</Critical>')

        lines.append('    </Task>')
    lines.append('  </Tasks>')

    # Assignments
    lines.append('  <Assignments>')
    for a in assignments:
        lines.append('    <Assignment>')
        lines.append(f'      <UID>{a["uid"]}</UID>')
        lines.append(f'      <TaskUID>{a["task_uid"]}</TaskUID>')
        lines.append(f'      <ResourceUID>{a["resource_uid"]}</ResourceUID>')
        wh = a.get("work_hours", 0) or 0
        lines.append(f'      <Work>{fmt_duration(wh)}</Work>')
        awh = a.get("actual_work_hours", 0) or 0
        lines.append(f'      <ActualWork>{fmt_duration(awh)}</ActualWork>')
        if a.get("baseline_work_hours") is not None:
            bwh = a["baseline_work_hours"]
            lines.append(f'      <BaselineWork>{fmt_duration(bwh)}</BaselineWork>')
        rwh = a.get("remaining_work_hours", 0) or 0
        lines.append(f'      <RemainingWork>{fmt_duration(rwh)}</RemainingWork>')

        c = a.get("cost", 0) or 0
        lines.append(f'      <Cost>{c}</Cost>')
        ac = a.get("actual_cost", 0) or 0
        lines.append(f'      <ActualCost>{ac}</ActualCost>')
        if a.get("baseline_cost") is not None:
            lines.append(f'      <BaselineCost>{a["baseline_cost"]}</BaselineCost>')

        if a.get("start"):
            lines.append(f'      <Start>{fmt_date(a["start"])}</Start>')
        if a.get("finish"):
            lines.append(f'      <Finish>{fmt_date(a["finish"])}</Finish>')
        if a.get("actual_start"):
            lines.append(f'      <ActualStart>{fmt_date(a["actual_start"])}</ActualStart>')
        if a.get("actual_finish"):
            lines.append(f'      <ActualFinish>{fmt_date(a["actual_finish"])}</ActualFinish>')

        lines.append('    </Assignment>')
    lines.append('  </Assignments>')

    lines.append('</Project>')
    return "\n".join(lines)


def esc(text: str) -> str:
    """Escape XML special characters."""
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;"))


# ────────────────────────────────────────────
# Main
# ────────────────────────────────────────────

def main():
    random.seed(2024)
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test_projects")
    os.makedirs(output_dir, exist_ok=True)

    profiles = make_project_profiles()

    print(f"Generating {len(profiles)} MS Project XML files...")
    print(f"Output directory: {output_dir}\n")

    summary = {"completed": 0, "in_progress": 0, "planning": 0}
    health_counts = {"green": 0, "amber": 0, "red": 0, "none": 0}

    for idx, profile in enumerate(profiles):
        project_name, xml = generate_project_xml(idx, profile)
        stage = profile["stage"]
        health = profile.get("health", "none")

        # Clean filename
        safe_name = project_name.replace(" ", "_").replace("/", "-").replace("&", "and")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in "_-.")
        filename = f"EV_{idx+1:02d}_{safe_name[:80]}.xml"

        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(xml)

        summary[stage] += 1
        health_counts[health] += 1

        anomaly_str = ", ".join(profile.get("anomalies", [])) or "none"
        print(f"  [{idx+1:2d}] {stage:<12} {health:<6} {filename}")

    print(f"\n{'='*60}")
    print(f"Generated {len(profiles)} files:")
    for stage, count in summary.items():
        print(f"  {stage}: {count}")
    print(f"\nHealth distribution:")
    for h, count in health_counts.items():
        print(f"  {h}: {count}")
    print(f"\nFiles written to: {output_dir}")


if __name__ == "__main__":
    main()
