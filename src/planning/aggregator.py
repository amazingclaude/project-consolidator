"""
Aggregation layer: converts contracts into RegionInput for the solver,
and distributes solver results back to contracts.
"""

import json
import math
from .solver import RegionInput, MonthlyAllocation, SolverResult


def aggregate_contracts_to_regions(contracts: list[dict]) -> list[RegionInput]:
    """
    Group active contracts by DNO region tags and produce one RegionInput per DNO.

    Each contract maps to one or more DNOs. When a contract spans N DNOs,
    its capacity and target are split equally across them.

    contracts: list of dicts with keys matching PlanContract columns.
    """
    dno_data: dict[str, dict] = {}

    active_contracts = [c for c in contracts if c.get("status", "active") == "active"]

    for c in active_contracts:
        dno_list = c.get("dno_regions", [])
        if isinstance(dno_list, str):
            try:
                dno_list = json.loads(dno_list)
            except (json.JSONDecodeError, TypeError):
                dno_list = []

        if not dno_list:
            continue

        n_dnos = len(dno_list)
        share = 1.0 / n_dnos

        capex_per_site = (
            c.get("capex_bom", 0) + c.get("capex_dno", 0) +
            c.get("capex_survey", 0) + c.get("capex_council", 0)
        )

        for dno_code in dno_list:
            if dno_code not in dno_data:
                dno_data[dno_code] = {
                    "contractors": 0,
                    "team_size": 0,
                    "team_count": 0,
                    "max_sites_sum": 0,
                    "target_sites": 0,
                    "priority_weighted": 0.0,
                    "capacity_total": 0.0,
                    "capex_weighted_sum": 0.0,
                    "capex_capacity_sum": 0.0,
                    "lead_time_min": 12,
                    "build_time_max": 0,
                    "contract_count": 0,
                }

            d = dno_data[dno_code]
            contract_contractors = max(1, round(c.get("contractors", 1) * share))
            contract_team_size = c.get("team_size_per_contractor", 4)
            contract_max_sites = c.get("max_sites_per_team_per_month", 2)
            contract_capacity = contract_contractors * contract_max_sites

            d["contractors"] += contract_contractors
            d["team_size"] += contract_team_size * contract_contractors
            d["team_count"] += contract_contractors
            d["max_sites_sum"] += contract_max_sites * contract_contractors
            d["target_sites"] += round(c.get("target_sites", 0) * share)
            d["priority_weighted"] += c.get("priority", 5) * contract_capacity
            d["capacity_total"] += contract_capacity
            d["capex_weighted_sum"] += capex_per_site * contract_capacity
            d["capex_capacity_sum"] += contract_capacity
            d["lead_time_min"] = min(d["lead_time_min"], c.get("lead_time_months", 2))
            d["build_time_max"] = max(d["build_time_max"], c.get("build_time_days", 30))
            d["contract_count"] += 1

    region_inputs = []
    for code, d in sorted(dno_data.items()):
        avg_team_size = round(d["team_size"] / d["team_count"]) if d["team_count"] > 0 else 4
        avg_max_sites = round(d["max_sites_sum"] / d["contractors"]) if d["contractors"] > 0 else 2
        avg_priority = round(d["priority_weighted"] / d["capacity_total"]) if d["capacity_total"] > 0 else 5
        avg_capex = d["capex_weighted_sum"] / d["capex_capacity_sum"] if d["capex_capacity_sum"] > 0 else 0

        region_inputs.append(RegionInput(
            region_code=code,
            region_name=code,
            priority=min(10, max(1, avg_priority)),
            target_sites=d["target_sites"],
            capex_per_site=avg_capex,
            contractors=d["contractors"],
            team_size_per_contractor=avg_team_size,
            max_sites_per_team_per_month=avg_max_sites,
            lead_time_months=d["lead_time_min"],
            build_time_days=d["build_time_max"],
        ))

    return region_inputs


def distribute_allocations_to_contracts(
    solver_result: SolverResult,
    contracts: list[dict],
    avg_sockets_per_site: float,
) -> list[dict]:
    """
    Distribute solver DNO-level allocations back to individual contracts,
    proportional to each contract's capacity share within each DNO.

    Returns list of dicts: {contract_id, month, planned_sites, planned_sockets, is_contingency}
    """
    dno_contract_caps: dict[str, list[tuple[int, float]]] = {}

    active_contracts = [c for c in contracts if c.get("status", "active") == "active"]

    for c in active_contracts:
        dno_list = c.get("dno_regions", [])
        if isinstance(dno_list, str):
            try:
                dno_list = json.loads(dno_list)
            except (json.JSONDecodeError, TypeError):
                dno_list = []

        n_dnos = len(dno_list) if dno_list else 1
        share = 1.0 / n_dnos
        capacity = c.get("contractors", 1) * c.get("max_sites_per_team_per_month", 2) * share

        for dno_code in dno_list:
            if dno_code not in dno_contract_caps:
                dno_contract_caps[dno_code] = []
            dno_contract_caps[dno_code].append((c["id"], capacity))

    contract_allocs: list[dict] = []

    for alloc in solver_result.allocations:
        dno = alloc.region_code
        month = alloc.month
        sites = alloc.planned_sites

        if sites <= 0 or dno not in dno_contract_caps:
            continue

        caps = dno_contract_caps[dno]
        total_cap = sum(cap for _, cap in caps)

        if total_cap <= 0:
            continue

        remaining_sites = sites
        for i, (contract_id, cap) in enumerate(caps):
            if i == len(caps) - 1:
                c_sites = remaining_sites
            else:
                c_sites = round(sites * (cap / total_cap))
                remaining_sites -= c_sites

            if c_sites > 0:
                contract_allocs.append({
                    "contract_id": contract_id,
                    "month": month,
                    "planned_sites": c_sites,
                    "planned_sockets": round(c_sites * avg_sockets_per_site),
                    "is_contingency": alloc.is_contingency,
                })

    return contract_allocs
