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
from dataclasses import dataclass

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
