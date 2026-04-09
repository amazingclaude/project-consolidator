# Fiscal Year Planning Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fiscal year planning module for EV charging socket deployment across UK DNO regions, with a hybrid deterministic solver + Claude AI contingency analysis.

**Architecture:** Standalone planning domain with 3 new DB tables (fiscal_plans, plan_regions, plan_monthly_allocations), a new FastAPI router at /api/planning/, a deterministic solver with seasonal/priority weighting, Claude AI post-analysis, and 3 new React pages (dashboard, input form, results view).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (mapped_column), Pydantic, Anthropic SDK, React 19, TypeScript, React Router 7, TanStack React Query, Zustand, Recharts, Tailwind CSS 4, Lucide icons.

**Reference:** Design doc at `docs/plans/2026-03-20-fiscal-year-planning-module-design.md`

---

## Task 1: Database Models

**Files:**
- Modify: `src/database/models.py` (append after line 176)

**Step 1: Add the three new SQLAlchemy models**

Append to `src/database/models.py` after the `IngestionLog` class:

```python
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

    plan: Mapped["FiscalPlan"] = relationship(back_populates="allocations")
```

**Step 2: Verify DB tables are auto-created**

The existing `get_engine()` in `src/database/db.py:19` calls `Base.metadata.create_all(_engine)` which will auto-create the new tables since our models extend the same `Base` class.

Run: `cd project-consolidator && python -c "from src.database.models import FiscalPlan, PlanRegion, PlanMonthlyAllocation; print('Models imported OK')"`
Expected: `Models imported OK`

**Step 3: Commit**

```bash
git add src/database/models.py
git commit -m "feat(planning): add FiscalPlan, PlanRegion, PlanMonthlyAllocation models"
```

---

## Task 2: DNO Regions Reference Data

**Files:**
- Create: `src/planning/__init__.py`
- Create: `src/planning/regions.py`

**Step 1: Create the planning package**

Create `src/planning/__init__.py` (empty file).

**Step 2: Create the DNO regions reference module**

Create `src/planning/regions.py`:

```python
"""UK Distribution Network Operator (DNO) regions reference data."""

DNO_REGIONS = [
    {"code": "ENWL", "name": "Electricity North West"},
    {"code": "NPG_NE", "name": "Northern Powergrid North East"},
    {"code": "NPG_YK", "name": "Northern Powergrid Yorkshire"},
    {"code": "SPEN_MW", "name": "SP Energy Networks Manweb"},
    {"code": "SPEN_D", "name": "SP Energy Networks Distribution"},
    {"code": "SSEN_S", "name": "SSEN Southern"},
    {"code": "SSEN_N", "name": "SSEN North"},
    {"code": "UKPN_SE", "name": "UK Power Networks South Eastern"},
    {"code": "UKPN_E", "name": "UK Power Networks Eastern"},
    {"code": "UKPN_LPN", "name": "UK Power Networks London"},
    {"code": "WPD_SM", "name": "WPD South Wales & South West"},
    {"code": "WPD_EM", "name": "WPD East Midlands"},
    {"code": "WPD_WM", "name": "WPD West Midlands"},
    {"code": "WPD_S", "name": "WPD South West"},
]

REGION_CODES = {r["code"] for r in DNO_REGIONS}
```

**Step 3: Commit**

```bash
git add src/planning/
git commit -m "feat(planning): add DNO regions reference data"
```

---

## Task 3: Deterministic Solver

**Files:**
- Create: `src/planning/solver.py`

**Step 1: Implement the solver**

Create `src/planning/solver.py`:

```python
"""
Deterministic allocation solver for fiscal year EV socket planning.

5-phase algorithm:
1. Capacity matrix computation
1b. Seasonal adjustment
2. Priority-weighted proportional allocation
3. Monthly scheduling with ramp-up
4. Shortfall redistribution (contingency)
5. Contingency buffer
"""

import math
from dataclasses import dataclass, field

# UK construction seasonality multipliers (Jan=index 0 .. Dec=index 11)
SEASONAL_MULTIPLIERS = [0.5, 0.6, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 0.6, 0.4]

# Ramp-up multipliers for first months of building in each region
RAMP_UP = [0.5, 0.75]  # month 1 = 50%, month 2 = 75%, month 3+ = 100%


@dataclass
class RegionInput:
    region_code: str
    region_name: str
    priority: int  # 1-10
    target_sites: int
    capex_per_site: float
    contractors: int
    team_size_per_contractor: int
    max_sites_per_team_per_month: int
    lead_time_months: int
    build_time_days: int


@dataclass
class MonthlyAllocation:
    region_code: str
    month: int  # 1-12
    planned_sites: int
    planned_sockets: int
    cumulative_sockets: int
    capex: float
    is_contingency: bool = False
    contingency_source_region: str | None = None


@dataclass
class SolverResult:
    allocations: list[MonthlyAllocation]
    total_sockets: int
    total_capex: float
    target_sockets: int
    shortfall: int
    capacity_utilization: dict[str, float]  # region_code -> % utilized


def solve(
    regions: list[RegionInput],
    target_sockets: int,
    avg_sockets_per_site: float,
    contingency_percent: float,
) -> SolverResult:
    """Run the 5-phase allocation algorithm."""

    if not regions or target_sockets <= 0:
        return SolverResult(
            allocations=[], total_sockets=0, total_capex=0.0,
            target_sockets=target_sockets, shortfall=target_sockets,
            capacity_utilization={},
        )

    # Phase 1 + 1b: Capacity matrix with seasonal adjustment
    region_monthly_cap: dict[str, list[float]] = {}  # region -> [cap_m1..cap_m12] in sites
    region_annual_cap: dict[str, float] = {}  # max sites per year

    for r in regions:
        base_monthly_sites = r.contractors * r.max_sites_per_team_per_month
        monthly_caps = []
        for m in range(12):
            if m < r.lead_time_months:
                monthly_caps.append(0.0)
            else:
                building_month_index = m - r.lead_time_months
                ramp = 1.0
                if building_month_index < len(RAMP_UP):
                    ramp = RAMP_UP[building_month_index]
                seasonal = SEASONAL_MULTIPLIERS[m]
                monthly_caps.append(base_monthly_sites * seasonal * ramp)

        region_monthly_cap[r.region_code] = monthly_caps
        region_annual_cap[r.region_code] = sum(monthly_caps)

    # Phase 2: Priority-weighted proportional allocation
    total_weighted_cap = 0.0
    region_weighted_cap: dict[str, float] = {}
    for r in regions:
        w = region_annual_cap[r.region_code] * (r.priority / 10.0)
        region_weighted_cap[r.region_code] = w
        total_weighted_cap += w

    # Target in sites (not sockets)
    target_sites_total = math.ceil(target_sockets / avg_sockets_per_site)

    region_target_sites: dict[str, float] = {}
    if total_weighted_cap > 0:
        for r in regions:
            proportion = region_weighted_cap[r.region_code] / total_weighted_cap
            target = target_sites_total * proportion
            # Cap at region's annual capacity
            target = min(target, region_annual_cap[r.region_code])
            region_target_sites[r.region_code] = target
    else:
        for r in regions:
            region_target_sites[r.region_code] = 0

    # Phase 3: Monthly scheduling with ramp-up
    # Distribute each region's target across its available months
    allocations: list[MonthlyAllocation] = []
    region_allocated: dict[str, float] = {r.region_code: 0 for r in regions}

    for r in regions:
        target = region_target_sites[r.region_code]
        remaining = target
        cumulative_sockets = 0

        for m in range(12):
            cap = region_monthly_cap[r.region_code][m]
            sites_this_month = min(remaining, cap)
            sites_int = int(round(sites_this_month))
            sockets = int(round(sites_int * avg_sockets_per_site))
            cumulative_sockets += sockets
            capex = sites_int * r.capex_per_site

            allocations.append(MonthlyAllocation(
                region_code=r.region_code,
                month=m + 1,
                planned_sites=sites_int,
                planned_sockets=sockets,
                cumulative_sockets=cumulative_sockets,
                capex=capex,
                is_contingency=False,
            ))

            remaining -= sites_this_month
            region_allocated[r.region_code] += sites_int
            if remaining <= 0:
                # Fill remaining months with zeros
                for m2 in range(m + 1, 12):
                    cumulative_sockets += 0
                    allocations.append(MonthlyAllocation(
                        region_code=r.region_code,
                        month=m2 + 1,
                        planned_sites=0,
                        planned_sockets=0,
                        cumulative_sockets=cumulative_sockets,
                        capex=0.0,
                        is_contingency=False,
                    ))
                break

    # Phase 4: Shortfall redistribution
    total_allocated_sites = sum(region_allocated.values())
    shortfall_sites = target_sites_total - total_allocated_sites

    if shortfall_sites > 0:
        # Find regions with spare capacity, sorted by priority (desc)
        spare: list[tuple[str, float, int]] = []  # (code, spare_cap, priority)
        region_map = {r.region_code: r for r in regions}
        for r in regions:
            spare_cap = region_annual_cap[r.region_code] - region_allocated[r.region_code]
            if spare_cap > 0:
                spare.append((r.region_code, spare_cap, r.priority))
        spare.sort(key=lambda x: x[2], reverse=True)

        remaining_shortfall = shortfall_sites
        for code, spare_cap, _ in spare:
            if remaining_shortfall <= 0:
                break
            extra = min(remaining_shortfall, spare_cap)
            # Distribute extra across months with spare capacity
            r = region_map[code]
            extra_remaining = extra
            for alloc in allocations:
                if alloc.region_code != code or extra_remaining <= 0:
                    continue
                cap = region_monthly_cap[code][alloc.month - 1]
                used = alloc.planned_sites
                available = cap - used
                if available > 0:
                    add = min(int(available), int(extra_remaining))
                    alloc.planned_sites += add
                    add_sockets = int(round(add * avg_sockets_per_site))
                    alloc.planned_sockets += add_sockets
                    alloc.capex += add * r.capex_per_site
                    alloc.is_contingency = True
                    extra_remaining -= add

            region_allocated[code] += (extra - extra_remaining)
            remaining_shortfall -= (extra - extra_remaining)

    # Recalculate cumulative sockets per region
    for r in regions:
        cumulative = 0
        for alloc in allocations:
            if alloc.region_code == r.region_code:
                cumulative += alloc.planned_sockets
                alloc.cumulative_sockets = cumulative

    # Phase 5: Contingency buffer
    if contingency_percent > 0:
        buffer_sites = math.ceil(target_sites_total * contingency_percent / 100.0)
        spare_after: list[tuple[str, float, int]] = []
        region_map = {r.region_code: r for r in regions}
        for r in regions:
            spare_cap = region_annual_cap[r.region_code] - region_allocated[r.region_code]
            if spare_cap > 0:
                spare_after.append((r.region_code, spare_cap, r.priority))
        spare_after.sort(key=lambda x: x[2], reverse=True)

        buffer_remaining = buffer_sites
        for code, spare_cap, _ in spare_after:
            if buffer_remaining <= 0:
                break
            extra = min(buffer_remaining, spare_cap)
            r = region_map[code]
            extra_remaining = extra
            for alloc in allocations:
                if alloc.region_code != code or extra_remaining <= 0:
                    continue
                cap = region_monthly_cap[code][alloc.month - 1]
                used = alloc.planned_sites
                available = cap - used
                if available > 0:
                    add = min(int(available), int(extra_remaining))
                    alloc.planned_sites += add
                    add_sockets = int(round(add * avg_sockets_per_site))
                    alloc.planned_sockets += add_sockets
                    alloc.capex += add * r.capex_per_site
                    alloc.is_contingency = True
                    extra_remaining -= add
            region_allocated[code] += (extra - extra_remaining)
            buffer_remaining -= (extra - extra_remaining)

        # Final cumulative recalc
        for r in regions:
            cumulative = 0
            for alloc in allocations:
                if alloc.region_code == r.region_code:
                    cumulative += alloc.planned_sockets
                    alloc.cumulative_sockets = cumulative

    # Compute totals
    total_sockets = sum(a.planned_sockets for a in allocations)
    total_capex = sum(a.capex for a in allocations)
    capacity_utilization = {}
    for r in regions:
        annual_cap = region_annual_cap[r.region_code]
        used = region_allocated[r.region_code]
        capacity_utilization[r.region_code] = (used / annual_cap * 100) if annual_cap > 0 else 0

    return SolverResult(
        allocations=allocations,
        total_sockets=total_sockets,
        total_capex=total_capex,
        target_sockets=target_sockets,
        shortfall=max(0, target_sockets - total_sockets),
        capacity_utilization=capacity_utilization,
    )
```

**Step 2: Verify import**

Run: `cd project-consolidator && python -c "from src.planning.solver import solve, RegionInput; print('Solver imported OK')"`
Expected: `Solver imported OK`

**Step 3: Commit**

```bash
git add src/planning/
git commit -m "feat(planning): implement 5-phase deterministic allocation solver"
```

---

## Task 4: Claude AI Contingency Analysis

**Files:**
- Create: `src/planning/contingency.py`

**Step 1: Implement the AI contingency analyzer**

Create `src/planning/contingency.py`:

```python
"""Claude AI contingency analysis for fiscal year planning."""

import json
import logging
import os
import yaml
from anthropic import Anthropic
from .solver import SolverResult

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert EV charging infrastructure planning analyst for the UK market.

You are reviewing a fiscal year deployment plan for EV charging sockets across UK DNO (Distribution Network Operator) regions.

Analyze the plan and provide:

## Risk Assessment
Identify which regions are at or near capacity, single points of failure (regions dependent on few contractors), and seasonal concentration risks.

## Contingency Recommendations
For each major risk, recommend specific mitigation actions:
- Which regions can absorb overflow if another region falls behind
- How many additional contractors would resolve bottlenecks
- Which months are most vulnerable to delays

## Scenario Analysis
Analyze these scenarios:
1. A high-priority region loses 1 contractor for 2 months — what's the impact and how to mitigate?
2. Winter is 20% worse than expected — which regions are affected and what's the shortfall?
3. Planning permission delays add 1 month lead time to 3 regions — can the target still be met?

## Executive Summary
A 3-4 sentence plain-English summary suitable for stakeholders, covering: will the target be met, what are the biggest risks, and what's the recommended action.

Format your response in clean markdown. Use tables where helpful. Be specific with numbers."""


def run_contingency_analysis(solver_result: SolverResult, regions_data: list[dict]) -> str:
    """Call Claude to analyze the solver output and generate contingency recommendations."""

    config_path = os.path.join(os.path.dirname(__file__), "..", "..", "config.yaml")
    config = {}
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = yaml.safe_load(f) or {}

    anthropic_config = config.get("anthropic", {})
    api_key = anthropic_config.get("api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    model = anthropic_config.get("model", "claude-sonnet-4-20250514")

    if not api_key:
        return "**AI analysis unavailable:** No Anthropic API key configured. Set ANTHROPIC_API_KEY environment variable or add it to config.yaml."

    # Build the plan summary for Claude
    plan_summary = _build_plan_summary(solver_result, regions_data)

    client = Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": plan_summary}],
        )
        text_blocks = [b.text for b in response.content if hasattr(b, "text")]
        return "\n".join(text_blocks)
    except Exception as e:
        logger.error(f"AI contingency analysis failed: {e}")
        return f"**AI analysis failed:** {str(e)}"


def _build_plan_summary(result: SolverResult, regions_data: list[dict]) -> str:
    """Format the solver result as a structured prompt for Claude."""

    lines = [
        f"# Fiscal Year Plan Summary",
        f"",
        f"**Target:** {result.target_sockets} sockets",
        f"**Achieved:** {result.total_sockets} sockets",
        f"**Shortfall:** {result.shortfall} sockets",
        f"**Total CAPEX:** £{result.total_capex:,.0f}",
        f"",
        f"## Regional Capacity Utilization",
        f"",
        f"| Region | Utilization % | Priority |",
        f"|--------|--------------|----------|",
    ]

    region_map = {r["region_code"]: r for r in regions_data}
    for code, util in sorted(result.capacity_utilization.items(), key=lambda x: x[1], reverse=True):
        r = region_map.get(code, {})
        priority = r.get("priority", "?")
        contractors = r.get("contractors", "?")
        lines.append(f"| {code} | {util:.1f}% | {priority}/10 (contractors: {contractors}) |")

    lines.extend([
        f"",
        f"## Monthly Allocation (sockets per region per month)",
        f"",
    ])

    # Build monthly table
    region_codes = sorted(set(a.region_code for a in result.allocations))
    header = "| Region | " + " | ".join(f"M{m}" for m in range(1, 13)) + " | Total |"
    sep = "|--------|" + "|".join("------" for _ in range(12)) + "|-------|"
    lines.append(header)
    lines.append(sep)

    for code in region_codes:
        monthly = {a.month: a.planned_sockets for a in result.allocations if a.region_code == code}
        cells = [str(monthly.get(m, 0)) for m in range(1, 13)]
        total = sum(monthly.values())
        lines.append(f"| {code} | " + " | ".join(cells) + f" | {total} |")

    # Monthly totals row
    month_totals = []
    for m in range(1, 13):
        t = sum(a.planned_sockets for a in result.allocations if a.month == m)
        month_totals.append(str(t))
    lines.append(f"| **TOTAL** | " + " | ".join(month_totals) + f" | {result.total_sockets} |")

    lines.extend([
        f"",
        f"## Contingency Allocations",
        f"",
    ])

    contingency_allocs = [a for a in result.allocations if a.is_contingency and a.planned_sockets > 0]
    if contingency_allocs:
        lines.append(f"| Region | Month | Sockets | Source |")
        lines.append(f"|--------|-------|---------|--------|")
        for a in contingency_allocs:
            source = a.contingency_source_region or "redistribution"
            lines.append(f"| {a.region_code} | M{a.month} | {a.planned_sockets} | {source} |")
    else:
        lines.append("No contingency allocations needed — base plan meets target.")

    return "\n".join(lines)
```

**Step 2: Verify import**

Run: `cd project-consolidator && python -c "from src.planning.contingency import run_contingency_analysis; print('Contingency module imported OK')"`
Expected: `Contingency module imported OK`

**Step 3: Commit**

```bash
git add src/planning/contingency.py
git commit -m "feat(planning): add Claude AI contingency analysis module"
```

---

## Task 5: Pydantic Schemas for Planning API

**Files:**
- Modify: `src/api/schemas.py` (append after line 322)

**Step 1: Add planning schemas**

Append to `src/api/schemas.py`:

```python

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


class UpdateStatusRequest(BaseModel):
    status: str  # "draft", "optimized", "approved"
```

**Step 2: Verify**

Run: `cd project-consolidator && python -c "from src.api.schemas import FiscalPlanDetail, CreatePlanRequest; print('Planning schemas OK')"`
Expected: `Planning schemas OK`

**Step 3: Commit**

```bash
git add src/api/schemas.py
git commit -m "feat(planning): add Pydantic schemas for planning API"
```

---

## Task 6: Planning API Router

**Files:**
- Create: `src/api/planning.py`
- Modify: `app.py` (add import + router registration at lines 16 and 42)

**Step 1: Create the planning router**

Create `src/api/planning.py`:

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..database.models import FiscalPlan, PlanRegion, PlanMonthlyAllocation
from ..planning.regions import DNO_REGIONS
from ..planning.solver import solve, RegionInput
from ..planning.contingency import run_contingency_analysis
from .schemas import (
    DNORegion,
    CreatePlanRequest,
    UpdatePlanRequest,
    UpdateStatusRequest,
    FiscalPlanSummary,
    FiscalPlanDetail,
    PlanRegionResponse,
    MonthlyAllocationResponse,
)

router = APIRouter(prefix="/api/planning", tags=["planning"])


@router.get("/regions", response_model=list[DNORegion])
def list_regions():
    return [DNORegion(**r) for r in DNO_REGIONS]


@router.get("/plans", response_model=list[FiscalPlanSummary])
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(FiscalPlan).order_by(FiscalPlan.updated_at.desc()).all()
    result = []
    for p in plans:
        total_sockets = sum(a.planned_sockets for a in p.allocations)
        total_capex = sum(a.capex for a in p.allocations)
        result.append(FiscalPlanSummary(
            id=p.id,
            name=p.name,
            fiscal_year=p.fiscal_year,
            target_sockets=p.target_sockets,
            status=p.status,
            avg_sockets_per_site=p.avg_sockets_per_site,
            contingency_percent=p.contingency_percent,
            created_at=p.created_at,
            updated_at=p.updated_at,
            total_achieved_sockets=total_sockets,
            total_capex=total_capex,
            region_count=len(p.regions),
        ))
    return result


@router.post("/plans", response_model=FiscalPlanDetail)
def create_plan(req: CreatePlanRequest, db: Session = Depends(get_db)):
    plan = FiscalPlan(
        name=req.name,
        fiscal_year=req.fiscal_year,
        target_sockets=req.target_sockets,
        avg_sockets_per_site=req.avg_sockets_per_site,
        contingency_percent=req.contingency_percent,
        notes=req.notes,
        status="draft",
    )
    db.add(plan)
    db.flush()

    for r in req.regions:
        region = PlanRegion(
            plan_id=plan.id,
            region_code=r.region_code,
            region_name=r.region_name,
            priority=r.priority,
            target_sites=r.target_sites,
            capex_per_site=r.capex_per_site,
            contractors=r.contractors,
            team_size_per_contractor=r.team_size_per_contractor,
            max_sites_per_team_per_month=r.max_sites_per_team_per_month,
            lead_time_months=r.lead_time_months,
            build_time_days=r.build_time_days,
        )
        db.add(region)

    db.commit()
    db.refresh(plan)
    return _plan_to_detail(plan)


@router.get("/plans/{plan_id}", response_model=FiscalPlanDetail)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _plan_to_detail(plan)


@router.put("/plans/{plan_id}", response_model=FiscalPlanDetail)
def update_plan(plan_id: int, req: UpdatePlanRequest, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if req.name is not None:
        plan.name = req.name
    if req.fiscal_year is not None:
        plan.fiscal_year = req.fiscal_year
    if req.target_sockets is not None:
        plan.target_sockets = req.target_sockets
    if req.avg_sockets_per_site is not None:
        plan.avg_sockets_per_site = req.avg_sockets_per_site
    if req.contingency_percent is not None:
        plan.contingency_percent = req.contingency_percent
    if req.notes is not None:
        plan.notes = req.notes

    if req.regions is not None:
        # Replace all regions
        db.query(PlanRegion).filter(PlanRegion.plan_id == plan_id).delete()
        for r in req.regions:
            region = PlanRegion(
                plan_id=plan_id,
                region_code=r.region_code,
                region_name=r.region_name,
                priority=r.priority,
                target_sites=r.target_sites,
                capex_per_site=r.capex_per_site,
                contractors=r.contractors,
                team_size_per_contractor=r.team_size_per_contractor,
                max_sites_per_team_per_month=r.max_sites_per_team_per_month,
                lead_time_months=r.lead_time_months,
                build_time_days=r.build_time_days,
            )
            db.add(region)

    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _plan_to_detail(plan)


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()
    return {"detail": "Plan deleted"}


@router.post("/plans/{plan_id}/optimize", response_model=FiscalPlanDetail)
def optimize_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.regions:
        raise HTTPException(status_code=400, detail="Plan has no regions configured")

    # Build solver inputs
    region_inputs = [
        RegionInput(
            region_code=r.region_code,
            region_name=r.region_name,
            priority=r.priority,
            target_sites=r.target_sites,
            capex_per_site=r.capex_per_site,
            contractors=r.contractors,
            team_size_per_contractor=r.team_size_per_contractor,
            max_sites_per_team_per_month=r.max_sites_per_team_per_month,
            lead_time_months=r.lead_time_months,
            build_time_days=r.build_time_days,
        )
        for r in plan.regions
    ]

    # Run solver
    result = solve(
        regions=region_inputs,
        target_sockets=plan.target_sockets,
        avg_sockets_per_site=plan.avg_sockets_per_site,
        contingency_percent=plan.contingency_percent,
    )

    # Clear old allocations and save new ones
    db.query(PlanMonthlyAllocation).filter(PlanMonthlyAllocation.plan_id == plan_id).delete()

    for a in result.allocations:
        alloc = PlanMonthlyAllocation(
            plan_id=plan_id,
            region_code=a.region_code,
            month=a.month,
            planned_sites=a.planned_sites,
            planned_sockets=a.planned_sockets,
            cumulative_sockets=a.cumulative_sockets,
            capex=a.capex,
            is_contingency=a.is_contingency,
            contingency_source_region=a.contingency_source_region,
        )
        db.add(alloc)

    # Run AI analysis
    regions_data = [
        {
            "region_code": r.region_code,
            "region_name": r.region_name,
            "priority": r.priority,
            "contractors": r.contractors,
            "capex_per_site": r.capex_per_site,
        }
        for r in plan.regions
    ]
    plan.ai_analysis = run_contingency_analysis(result, regions_data)
    plan.status = "optimized"
    plan.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(plan)
    return _plan_to_detail(plan)


@router.put("/plans/{plan_id}/status", response_model=FiscalPlanDetail)
def update_plan_status(plan_id: int, req: UpdateStatusRequest, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if req.status not in ("draft", "optimized", "approved"):
        raise HTTPException(status_code=400, detail="Invalid status")
    plan.status = req.status
    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _plan_to_detail(plan)


def _plan_to_detail(plan: FiscalPlan) -> FiscalPlanDetail:
    """Convert a FiscalPlan ORM object to FiscalPlanDetail response."""
    total_sockets = sum(a.planned_sockets for a in plan.allocations)
    total_capex = sum(a.capex for a in plan.allocations)

    # Compute capacity utilization from allocations
    capacity_utilization: dict[str, float] = {}
    if plan.regions and plan.allocations:
        for r in plan.regions:
            region_sockets = sum(a.planned_sockets for a in plan.allocations if a.region_code == r.region_code)
            # Rough utilization: what fraction of 12 months × capacity was used
            base_cap = r.contractors * r.max_sites_per_team_per_month
            annual_cap_sockets = base_cap * 12 * plan.avg_sockets_per_site
            capacity_utilization[r.region_code] = (region_sockets / annual_cap_sockets * 100) if annual_cap_sockets > 0 else 0

    return FiscalPlanDetail(
        id=plan.id,
        name=plan.name,
        fiscal_year=plan.fiscal_year,
        target_sockets=plan.target_sockets,
        status=plan.status,
        avg_sockets_per_site=plan.avg_sockets_per_site,
        contingency_percent=plan.contingency_percent,
        ai_analysis=plan.ai_analysis,
        notes=plan.notes,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        regions=[
            PlanRegionResponse(
                id=r.id,
                plan_id=r.plan_id,
                region_code=r.region_code,
                region_name=r.region_name,
                priority=r.priority,
                target_sites=r.target_sites,
                capex_per_site=r.capex_per_site,
                contractors=r.contractors,
                team_size_per_contractor=r.team_size_per_contractor,
                max_sites_per_team_per_month=r.max_sites_per_team_per_month,
                lead_time_months=r.lead_time_months,
                build_time_days=r.build_time_days,
            )
            for r in plan.regions
        ],
        allocations=[
            MonthlyAllocationResponse(
                id=a.id,
                region_code=a.region_code,
                month=a.month,
                planned_sites=a.planned_sites,
                planned_sockets=a.planned_sockets,
                cumulative_sockets=a.cumulative_sockets,
                capex=a.capex,
                is_contingency=a.is_contingency,
                contingency_source_region=a.contingency_source_region,
            )
            for a in plan.allocations
        ],
        total_achieved_sockets=total_sockets,
        total_capex=total_capex,
        capacity_utilization=capacity_utilization,
    )
```

**Step 2: Register the router in app.py**

Add after line 16 in `app.py`:
```python
from src.api.planning import router as planning_router
```

Add after line 42 in `app.py` (after `app.include_router(nlp_router)`):
```python
app.include_router(planning_router)
```

**Step 3: Verify the API starts**

Run: `cd project-consolidator && python -c "from src.api.planning import router; print(f'Planning router OK: {len(router.routes)} routes')"`
Expected: `Planning router OK: 8 routes`

**Step 4: Commit**

```bash
git add src/api/planning.py app.py
git commit -m "feat(planning): add planning API router with full CRUD + optimize endpoint"
```

---

## Task 7: Frontend API Client — PUT/DELETE Helpers + Planning Types

**Files:**
- Modify: `frontend/src/api/client.ts` (add `putApi` and `deleteApi` after line 46)
- Modify: `frontend/src/api/types.ts` (append planning interfaces)
- Create: `frontend/src/api/planning.ts`

**Step 1: Add putApi and deleteApi to client.ts**

Append after the `postApi` function (line 46) in `frontend/src/api/client.ts`:

```typescript
export async function putApi<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function deleteApi<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<T>(response);
}
```

**Step 2: Add planning TypeScript interfaces to types.ts**

Append to `frontend/src/api/types.ts`:

```typescript

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
}
```

**Step 3: Create planning API hooks**

Create `frontend/src/api/planning.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, postApi, putApi, deleteApi } from './client';
import type {
  DNORegion,
  FiscalPlanSummary,
  FiscalPlanDetail,
  CreatePlanRequest,
  UpdatePlanRequest,
} from './types';

export function useDNORegions() {
  return useQuery<DNORegion[]>({
    queryKey: ['planning', 'regions'],
    queryFn: () => fetchApi<DNORegion[]>('/api/planning/regions'),
  });
}

export function useFiscalPlans() {
  return useQuery<FiscalPlanSummary[]>({
    queryKey: ['planning', 'plans'],
    queryFn: () => fetchApi<FiscalPlanSummary[]>('/api/planning/plans'),
  });
}

export function useFiscalPlan(planId: number | undefined) {
  return useQuery<FiscalPlanDetail>({
    queryKey: ['planning', 'plans', planId],
    queryFn: () => fetchApi<FiscalPlanDetail>(`/api/planning/plans/${planId}`),
    enabled: planId !== undefined,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, CreatePlanRequest>({
    mutationFn: (data) => postApi<FiscalPlanDetail>('/api/planning/plans', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useUpdatePlan(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, UpdatePlanRequest>({
    mutationFn: (data) => putApi<FiscalPlanDetail>(`/api/planning/plans/${planId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: (planId) => deleteApi(`/api/planning/plans/${planId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useOptimizePlan(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, void>({
    mutationFn: () => postApi<FiscalPlanDetail>(`/api/planning/plans/${planId}/optimize`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useUpdatePlanStatus(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, string>({
    mutationFn: (status) => putApi<FiscalPlanDetail>(`/api/planning/plans/${planId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}
```

**Step 4: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/types.ts frontend/src/api/planning.ts
git commit -m "feat(planning): add frontend API client with planning types and hooks"
```

---

## Task 8: Planning Dashboard Page

**Files:**
- Create: `frontend/src/pages/PlanningDashboard.tsx`

**Step 1: Create the planning dashboard page**

Create `frontend/src/pages/PlanningDashboard.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Plus,
  Target,
  PoundSterling,
  MapPin,
  Trash2,
  CheckCircle2,
  Clock,
  Pencil,
} from 'lucide-react';
import { useFiscalPlans, useDeletePlan } from '../api/planning';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  optimized: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Optimized' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
};

function PlanningDashboard() {
  const navigate = useNavigate();
  const { data: plans, isLoading, error, refetch } = useFiscalPlans();
  const deleteMutation = useDeletePlan();
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete plan "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Fiscal Year Planning" subtitle="EV charging socket deployment planning" />
        <LoadingState message="Loading plans..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Fiscal Year Planning" subtitle="EV charging socket deployment planning" />
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load plans'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const totalPlans = plans?.length ?? 0;
  const approvedPlans = plans?.filter((p) => p.status === 'approved').length ?? 0;
  const totalTargetSockets = plans?.reduce((sum, p) => sum + p.target_sockets, 0) ?? 0;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader title="Fiscal Year Planning" subtitle="EV charging socket deployment planning" />
        <button
          onClick={() => navigate('/planning/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Plans"
          value={totalPlans}
          icon={<CalendarRange className="h-5 w-5" />}
        />
        <MetricCard
          label="Approved Plans"
          value={approvedPlans}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Total Target Sockets"
          value={totalTargetSockets.toLocaleString()}
          icon={<Target className="h-5 w-5" />}
        />
      </div>

      {/* Plans list */}
      {totalPlans === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <CalendarRange className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No plans yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create your first fiscal year plan to get started with EV socket deployment planning.
          </p>
          <button
            onClick={() => navigate('/planning/new')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans?.map((plan) => {
            const status = STATUS_STYLES[plan.status] || STATUS_STYLES.draft;
            const achievedPct = plan.target_sockets > 0
              ? Math.round((plan.total_achieved_sockets / plan.target_sockets) * 100)
              : 0;

            return (
              <div
                key={plan.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-200 transition-colors cursor-pointer"
                onClick={() => navigate(`/planning/${plan.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {plan.name}
                      </h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarRange className="h-3.5 w-3.5" />
                        FY{plan.fiscal_year}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        {plan.target_sockets.toLocaleString()} target sockets
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {plan.region_count} regions
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <PoundSterling className="h-3.5 w-3.5" />
                        £{(plan.total_capex / 1_000_000).toFixed(1)}M CAPEX
                      </span>
                      {plan.status !== 'draft' && (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {plan.total_achieved_sockets.toLocaleString()} achieved ({achievedPct}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/planning/${plan.id}/edit`);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(plan.id, plan.name);
                      }}
                      disabled={deleting === plan.id}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PlanningDashboard;
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PlanningDashboard.tsx
git commit -m "feat(planning): add planning dashboard page"
```

---

## Task 9: Plan Input Form Page

**Files:**
- Create: `frontend/src/pages/PlanForm.tsx`

**Step 1: Create the plan input form page**

Create `frontend/src/pages/PlanForm.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Save,
  Loader2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import {
  useDNORegions,
  useFiscalPlan,
  useCreatePlan,
  useUpdatePlan,
  useOptimizePlan,
} from '../api/planning';
import type { PlanRegionInput } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';

const DEFAULT_REGION: Omit<PlanRegionInput, 'region_code' | 'region_name'> = {
  priority: 5,
  target_sites: 10,
  capex_per_site: 50000,
  contractors: 2,
  team_size_per_contractor: 4,
  max_sites_per_team_per_month: 2,
  lead_time_months: 2,
  build_time_days: 30,
};

function PlanForm() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const isEdit = planId !== undefined;
  const planIdNum = planId ? parseInt(planId, 10) : undefined;

  const { data: dnoRegions, isLoading: regionsLoading } = useDNORegions();
  const { data: existingPlan, isLoading: planLoading } = useFiscalPlan(planIdNum);

  const createMutation = useCreatePlan();
  const updateMutation = useUpdatePlan(planIdNum ?? 0);
  const optimizeMutation = useOptimizePlan(planIdNum ?? 0);

  // Form state
  const [name, setName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [targetSockets, setTargetSockets] = useState(5000);
  const [avgSocketsPerSite, setAvgSocketsPerSite] = useState(6);
  const [contingencyPercent, setContingencyPercent] = useState(10);
  const [notes, setNotes] = useState('');
  const [regions, setRegions] = useState<PlanRegionInput[]>([]);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [enabledRegions, setEnabledRegions] = useState<Set<string>>(new Set());

  // Initialize from existing plan or defaults
  useEffect(() => {
    if (isEdit && existingPlan) {
      setName(existingPlan.name);
      setFiscalYear(existingPlan.fiscal_year);
      setTargetSockets(existingPlan.target_sockets);
      setAvgSocketsPerSite(existingPlan.avg_sockets_per_site);
      setContingencyPercent(existingPlan.contingency_percent);
      setNotes(existingPlan.notes || '');
      setRegions(existingPlan.regions.map((r) => ({
        region_code: r.region_code,
        region_name: r.region_name,
        priority: r.priority,
        target_sites: r.target_sites,
        capex_per_site: r.capex_per_site,
        contractors: r.contractors,
        team_size_per_contractor: r.team_size_per_contractor,
        max_sites_per_team_per_month: r.max_sites_per_team_per_month,
        lead_time_months: r.lead_time_months,
        build_time_days: r.build_time_days,
      })));
      setEnabledRegions(new Set(existingPlan.regions.map((r) => r.region_code)));
    } else if (!isEdit && dnoRegions) {
      setRegions(dnoRegions.map((r) => ({
        region_code: r.code,
        region_name: r.name,
        ...DEFAULT_REGION,
      })));
      setEnabledRegions(new Set(dnoRegions.map((r) => r.code)));
    }
  }, [isEdit, existingPlan, dnoRegions]);

  const toggleRegion = useCallback((code: string) => {
    setEnabledRegions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((code: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const updateRegion = useCallback((code: string, field: keyof PlanRegionInput, value: number) => {
    setRegions((prev) =>
      prev.map((r) => (r.region_code === code ? { ...r, [field]: value } : r))
    );
  }, []);

  const copyToAll = useCallback(() => {
    const first = regions.find((r) => enabledRegions.has(r.region_code));
    if (!first) return;
    setRegions((prev) =>
      prev.map((r) =>
        enabledRegions.has(r.region_code)
          ? {
              ...r,
              priority: first.priority,
              target_sites: first.target_sites,
              capex_per_site: first.capex_per_site,
              contractors: first.contractors,
              team_size_per_contractor: first.team_size_per_contractor,
              max_sites_per_team_per_month: first.max_sites_per_team_per_month,
              lead_time_months: first.lead_time_months,
              build_time_days: first.build_time_days,
            }
          : r
      )
    );
  }, [regions, enabledRegions]);

  const handleSave = async () => {
    const activeRegions = regions.filter((r) => enabledRegions.has(r.region_code));
    const payload = {
      name,
      fiscal_year: fiscalYear,
      target_sockets: targetSockets,
      avg_sockets_per_site: avgSocketsPerSite,
      contingency_percent: contingencyPercent,
      notes: notes || undefined,
      regions: activeRegions,
    };

    if (isEdit) {
      await updateMutation.mutateAsync(payload);
      navigate(`/planning/${planId}`);
    } else {
      const result = await createMutation.mutateAsync(payload);
      navigate(`/planning/${result.id}`);
    }
  };

  const handleSaveAndOptimize = async () => {
    const activeRegions = regions.filter((r) => enabledRegions.has(r.region_code));
    const payload = {
      name,
      fiscal_year: fiscalYear,
      target_sockets: targetSockets,
      avg_sockets_per_site: avgSocketsPerSite,
      contingency_percent: contingencyPercent,
      notes: notes || undefined,
      regions: activeRegions,
    };

    let id = planIdNum;
    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      const result = await createMutation.mutateAsync(payload);
      id = result.id;
    }

    if (id) {
      // Need to use a fresh mutation for the new plan ID
      await optimizeMutation.mutateAsync();
      navigate(`/planning/${id}`);
    }
  };

  if (regionsLoading || (isEdit && planLoading)) {
    return (
      <div className="p-6">
        <PageHeader title={isEdit ? 'Edit Plan' : 'New Fiscal Year Plan'} subtitle="Configure deployment targets and regional parameters" />
        <LoadingState message="Loading..." />
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || optimizeMutation.isPending;

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/planning')}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          title={isEdit ? 'Edit Plan' : 'New Fiscal Year Plan'}
          subtitle="Configure deployment targets and regional parameters"
        />
      </div>

      {/* Plan basics */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Plan Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FY2026 Socket Rollout Plan"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Sockets (overall)</label>
            <input
              type="number"
              value={targetSockets}
              onChange={(e) => setTargetSockets(parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avg Sockets per Site</label>
            <input
              type="number"
              value={avgSocketsPerSite}
              onChange={(e) => setAvgSocketsPerSite(parseFloat(e.target.value) || 1)}
              min={1}
              step={0.5}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contingency Buffer: {contingencyPercent}%
            </label>
            <input
              type="range"
              min={0}
              max={25}
              value={contingencyPercent}
              onChange={(e) => setContingencyPercent(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Region configuration */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            DNO Regions ({enabledRegions.size} of {regions.length} enabled)
          </h2>
          <button
            onClick={copyToAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy first region's settings to all
          </button>
        </div>

        {regions.map((region) => {
          const isEnabled = enabledRegions.has(region.region_code);
          const isExpanded = expandedRegions.has(region.region_code);

          return (
            <div
              key={region.region_code}
              className={`rounded-lg border bg-white shadow-sm transition-colors ${
                isEnabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              {/* Region header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleRegion(region.region_code)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <button
                  onClick={() => toggleExpand(region.region_code)}
                  className="flex items-center gap-2 flex-1 text-left"
                  disabled={!isEnabled}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{region.region_name}</span>
                  <span className="text-xs text-gray-400">({region.region_code})</span>
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Priority: {region.priority}/10</span>
                  <span>·</span>
                  <span>{region.contractors} contractors</span>
                </div>
              </div>

              {/* Expanded region details */}
              {isExpanded && isEnabled && (
                <div className="border-t border-gray-100 px-4 py-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Priority (1-10)</label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={region.priority}
                        onChange={(e) => updateRegion(region.region_code, 'priority', parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-400">{region.priority}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Target Sites</label>
                      <input
                        type="number"
                        value={region.target_sites}
                        onChange={(e) => updateRegion(region.region_code, 'target_sites', parseInt(e.target.value, 10) || 0)}
                        min={0}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">CAPEX per Site (£)</label>
                      <input
                        type="number"
                        value={region.capex_per_site}
                        onChange={(e) => updateRegion(region.region_code, 'capex_per_site', parseFloat(e.target.value) || 0)}
                        min={0}
                        step={1000}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Contractors</label>
                      <input
                        type="number"
                        value={region.contractors}
                        onChange={(e) => updateRegion(region.region_code, 'contractors', parseInt(e.target.value, 10) || 1)}
                        min={1}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Team Size / Contractor</label>
                      <input
                        type="number"
                        value={region.team_size_per_contractor}
                        onChange={(e) => updateRegion(region.region_code, 'team_size_per_contractor', parseInt(e.target.value, 10) || 1)}
                        min={1}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Max Sites/Team/Month</label>
                      <input
                        type="number"
                        value={region.max_sites_per_team_per_month}
                        onChange={(e) => updateRegion(region.region_code, 'max_sites_per_team_per_month', parseInt(e.target.value, 10) || 1)}
                        min={1}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Lead Time (months)</label>
                      <input
                        type="number"
                        value={region.lead_time_months}
                        onChange={(e) => updateRegion(region.region_code, 'lead_time_months', parseInt(e.target.value, 10) || 0)}
                        min={0}
                        max={6}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Build Time (days)</label>
                      <input
                        type="number"
                        value={region.build_time_days}
                        onChange={(e) => updateRegion(region.region_code, 'build_time_days', parseInt(e.target.value, 10) || 1)}
                        min={1}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Action buttons */}
      <section className="flex items-center gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={!name.trim() || enabledRegions.size === 0 || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {(createMutation.isPending || updateMutation.isPending) && !optimizeMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save as Draft
        </button>
        <button
          onClick={handleSaveAndOptimize}
          disabled={!name.trim() || enabledRegions.size === 0 || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {optimizeMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Save & Generate Plan
        </button>
      </section>
    </div>
  );
}

export default PlanForm;
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PlanForm.tsx
git commit -m "feat(planning): add plan input form page with region configuration"
```

---

## Task 10: Plan Results View Page

**Files:**
- Create: `frontend/src/pages/PlanView_FY.tsx`

**Step 1: Create the plan results view page**

Create `frontend/src/pages/PlanView_FY.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Target,
  PoundSterling,
  TrendingUp,
  Shield,
  ArrowLeft,
  Pencil,
  Copy,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useFiscalPlan, useOptimizePlan, useUpdatePlanStatus } from '../api/planning';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const UTIL_COLORS: [number, string][] = [
  [90, 'bg-red-200 text-red-800'],
  [70, 'bg-amber-100 text-amber-800'],
  [40, 'bg-blue-100 text-blue-800'],
  [0, 'bg-gray-100 text-gray-600'],
];

function getUtilClass(pct: number): string {
  for (const [threshold, cls] of UTIL_COLORS) {
    if (pct >= threshold) return cls;
  }
  return UTIL_COLORS[UTIL_COLORS.length - 1][1];
}

function PlanViewFY() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const planIdNum = planId ? parseInt(planId, 10) : undefined;

  const { data: plan, isLoading, error, refetch } = useFiscalPlan(planIdNum);
  const optimizeMutation = useOptimizePlan(planIdNum ?? 0);
  const statusMutation = useUpdatePlanStatus(planIdNum ?? 0);

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Plan Details" subtitle="" />
        <LoadingState message="Loading plan..." />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-6">
        <PageHeader title="Plan Details" subtitle="" />
        <ErrorState
          message={error instanceof Error ? error.message : 'Plan not found'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const hasAllocations = plan.allocations.length > 0;
  const achievedPct = plan.target_sockets > 0
    ? Math.round((plan.total_achieved_sockets / plan.target_sockets) * 100)
    : 0;
  const peakUtil = Object.values(plan.capacity_utilization).length > 0
    ? Math.max(...Object.values(plan.capacity_utilization))
    : 0;
  const contingencySockets = plan.allocations
    .filter((a) => a.is_contingency)
    .reduce((sum, a) => sum + a.planned_sockets, 0);

  // Build monthly cumulative data for chart
  const chartData = MONTH_LABELS.map((label, i) => {
    const monthNum = i + 1;
    const monthSockets = plan.allocations
      .filter((a) => a.month === monthNum)
      .reduce((sum, a) => sum + a.planned_sockets, 0);
    return { month: label, sockets: monthSockets };
  });

  // Cumulative
  let cumulative = 0;
  const cumulativeData = chartData.map((d) => {
    cumulative += d.sockets;
    return { ...d, cumulative, target: plan.target_sockets };
  });

  // Build region monthly grid
  const regionCodes = [...new Set(plan.allocations.map((a) => a.region_code))].sort();
  const regionNames: Record<string, string> = {};
  plan.regions.forEach((r) => { regionNames[r.region_code] = r.region_name; });

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/planning')}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <PageHeader
            title={plan.name}
            subtitle={`FY${plan.fiscal_year} · ${plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {plan.status !== 'approved' && (
            <button
              onClick={() => navigate(`/planning/${plan.id}/edit`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {plan.status === 'draft' && (
            <button
              onClick={() => optimizeMutation.mutate()}
              disabled={optimizeMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              {optimizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Plan
            </button>
          )}
          {plan.status === 'optimized' && (
            <button
              onClick={() => statusMutation.mutate('approved')}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300 transition-colors"
            >
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve Plan
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {hasAllocations && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Target vs Achieved"
            value={`${plan.total_achieved_sockets.toLocaleString()} / ${plan.target_sockets.toLocaleString()}`}
            delta={`${achievedPct}%`}
            deltaPositive={achievedPct >= 95}
            icon={<Target className="h-5 w-5" />}
          />
          <MetricCard
            label="Total CAPEX"
            value={`£${(plan.total_capex / 1_000_000).toFixed(2)}M`}
            icon={<PoundSterling className="h-5 w-5" />}
          />
          <MetricCard
            label="Peak Utilization"
            value={`${peakUtil.toFixed(0)}%`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            label="Contingency Sockets"
            value={contingencySockets.toLocaleString()}
            icon={<Shield className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Cumulative progress chart */}
      {hasAllocations && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cumulative Socket Deployment</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={plan.target_sockets} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative Sockets"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Monthly allocation heatmap */}
      {hasAllocations && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Allocation (Sockets)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Region</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="text-center py-2 px-2 font-medium text-gray-700 w-16">{m}</th>
                  ))}
                  <th className="text-center py-2 px-3 font-medium text-gray-700">Total</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-700">Util%</th>
                </tr>
              </thead>
              <tbody>
                {regionCodes.map((code) => {
                  const regionAllocs = plan.allocations.filter((a) => a.region_code === code);
                  const monthMap: Record<number, { sockets: number; contingency: boolean }> = {};
                  regionAllocs.forEach((a) => {
                    monthMap[a.month] = { sockets: a.planned_sockets, contingency: a.is_contingency };
                  });
                  const total = regionAllocs.reduce((sum, a) => sum + a.planned_sockets, 0);
                  const util = plan.capacity_utilization[code] ?? 0;

                  return (
                    <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900 whitespace-nowrap">
                        {regionNames[code] || code}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const cell = monthMap[m];
                        const sockets = cell?.sockets ?? 0;
                        const isContingency = cell?.contingency ?? false;
                        return (
                          <td key={m} className="text-center py-2 px-2">
                            {sockets > 0 ? (
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                  isContingency ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {sockets}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center py-2 px-3 font-semibold text-gray-900">{total}</td>
                      <td className="text-center py-2 px-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getUtilClass(util)}`}>
                          {util.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="py-2 px-3 text-gray-900">Total</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const monthTotal = plan.allocations
                      .filter((a) => a.month === m)
                      .reduce((sum, a) => sum + a.planned_sockets, 0);
                    return (
                      <td key={m} className="text-center py-2 px-2 text-gray-900">
                        {monthTotal || '-'}
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-3 text-gray-900">{plan.total_achieved_sockets}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-blue-100" /> Base allocation
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-amber-100" /> Contingency/redistribution
            </span>
          </div>
        </section>
      )}

      {/* AI Analysis */}
      {plan.ai_analysis && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Contingency Analysis</h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{plan.ai_analysis}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* Empty state for draft plans */}
      {!hasAllocations && (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Plan not yet generated</h3>
          <p className="mt-2 text-sm text-gray-500">
            This plan is in draft. Click "Generate Plan" to run the optimization algorithm and AI analysis.
          </p>
        </div>
      )}
    </div>
  );
}

export default PlanViewFY;
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PlanView_FY.tsx
git commit -m "feat(planning): add plan results view with heatmap table, chart, and AI analysis"
```

---

## Task 11: Wire Up Routes and Sidebar Navigation

**Files:**
- Modify: `frontend/src/App.tsx` (add lazy imports + routes)
- Modify: `frontend/src/components/layout/Sidebar.tsx` (add Planning nav section)

**Step 1: Add lazy imports and routes to App.tsx**

Add after line 15 (`const PlanView = React.lazy(...)`) in `frontend/src/App.tsx`:

```typescript
const PlanningDashboard = React.lazy(() => import('./pages/PlanningDashboard'));
const PlanForm = React.lazy(() => import('./pages/PlanForm'));
const PlanViewFY = React.lazy(() => import('./pages/PlanView_FY'));
```

Add these routes after the `/ingestion` route (before the `</Routes>` closing tag) inside the `<Suspense>` block:

```tsx
            <Route path="/planning" element={<PlanningDashboard />} />
            <Route path="/planning/new" element={<PlanForm />} />
            <Route path="/planning/:planId" element={<PlanViewFY />} />
            <Route path="/planning/:planId/edit" element={<PlanForm />} />
```

**Step 2: Add Planning section to Sidebar.tsx**

In `frontend/src/components/layout/Sidebar.tsx`, add the `CalendarRange` import to the lucide-react import (line 2-12):

Add `CalendarRange` to the import list.

Then add a new nav section after the 'AI' section (after line 47, before the 'Admin' section):

```typescript
  {
    title: 'Planning',
    items: [
      { to: '/planning', label: 'Fiscal Year Planning', icon: <CalendarRange size={18} /> },
    ],
  },
```

**Step 3: Verify build compiles**

Run: `cd project-consolidator/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(planning): wire up routes and sidebar navigation"
```

---

## Task 12: End-to-End Smoke Test

**Step 1: Restart the backend to pick up new models/routes**

Kill and restart the backend: `cd project-consolidator && python app.py`

**Step 2: Verify API endpoints**

Run: `curl -s http://localhost:8000/api/planning/regions | python -m json.tool | head -20`
Expected: JSON array of 14 DNO regions

Run: `curl -s -X POST http://localhost:8000/api/planning/plans -H 'Content-Type: application/json' -d '{"name":"Test Plan","fiscal_year":2026,"target_sockets":1000,"regions":[{"region_code":"UKPN_SE","region_name":"UKPN South Eastern","priority":8,"target_sites":20,"capex_per_site":50000,"contractors":3,"team_size_per_contractor":4,"max_sites_per_team_per_month":2,"lead_time_months":2,"build_time_days":30}]}' | python -m json.tool | head -10`
Expected: JSON with created plan (status: "draft")

Run: `curl -s -X POST http://localhost:8000/api/planning/plans/1/optimize | python -m json.tool | head -20`
Expected: JSON with optimized plan (status: "optimized", allocations populated)

**Step 3: Verify frontend renders**

Open http://localhost:5173/planning in browser. Should see Planning Dashboard with the test plan listed.

**Step 4: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(planning): smoke test fixes"
```

---

## Task 13: Fix PlanForm optimize for new plans

The `handleSaveAndOptimize` function in PlanForm.tsx has a bug: it tries to use `optimizeMutation` which was initialized with `planIdNum ?? 0`. For newly created plans, the plan ID won't be known until after creation. Fix this by using `postApi` directly for the optimize call after creation.

**Files:**
- Modify: `frontend/src/pages/PlanForm.tsx`

**Step 1: Fix the handleSaveAndOptimize function**

Replace the `handleSaveAndOptimize` function to handle both create-then-optimize and edit-then-optimize flows:

```tsx
  const handleSaveAndOptimize = async () => {
    const activeRegions = regions.filter((r) => enabledRegions.has(r.region_code));
    const payload = {
      name,
      fiscal_year: fiscalYear,
      target_sockets: targetSockets,
      avg_sockets_per_site: avgSocketsPerSite,
      contingency_percent: contingencyPercent,
      notes: notes || undefined,
      regions: activeRegions,
    };

    let id: number;
    if (isEdit && planIdNum) {
      await updateMutation.mutateAsync(payload);
      id = planIdNum;
    } else {
      const result = await createMutation.mutateAsync(payload);
      id = result.id;
    }

    // Optimize using direct API call (works for both new and existing plans)
    const { postApi } = await import('../api/client');
    await postApi(`/api/planning/plans/${id}/optimize`, {});
    navigate(`/planning/${id}`);
  };
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PlanForm.tsx
git commit -m "fix(planning): handle optimize for newly created plans"
```
