"""Azure AI Foundry contingency analysis for fiscal year planning."""

import logging

from ..ai.foundry import create_foundry_client, get_foundry_settings, validate_foundry_settings
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
1. A high-priority region loses 1 contractor for 2 months - what's the impact and how to mitigate?
2. Winter is 20% worse than expected - which regions are affected and what's the shortfall?
3. Planning permission delays add 1 month lead time to 3 regions - can the target still be met?

## Executive Summary
A 3-4 sentence plain-English summary suitable for stakeholders, covering: will the target be met, what are the biggest risks, and what's the recommended action.

Format your response in clean markdown. Use tables where helpful. Be specific with numbers."""


def _run_foundry_response(prompt: str, system_prompt: str, max_tokens: int) -> str:
    settings = get_foundry_settings()
    client = create_foundry_client()
    response = client.responses.create(
        model=settings["model"],
        instructions=system_prompt,
        input=prompt,
        max_output_tokens=max_tokens,
    )
    return response.output_text or ""



def run_contingency_analysis(solver_result: SolverResult, regions_data: list[dict]) -> str:
    """Call Azure AI Foundry to analyze the solver output and generate contingency recommendations."""
    is_valid, error_message = validate_foundry_settings()
    if not is_valid:
        return f"**AI analysis unavailable:** {error_message}"

    plan_summary = _build_plan_summary(solver_result, regions_data)
    settings = get_foundry_settings()

    try:
        return _run_foundry_response(plan_summary, SYSTEM_PROMPT, settings["max_tokens"])
    except Exception as e:
        logger.error(f"AI contingency analysis failed: {e}")
        return f"**AI analysis failed:** {str(e)}"



def _build_plan_summary(result: SolverResult, regions_data: list[dict]) -> str:
    """Format the solver result as a structured prompt for Azure AI Foundry."""
    lines = [
        "# Fiscal Year Plan Summary",
        "",
        f"**Target:** {result.target_sockets} sockets",
        f"**Achieved:** {result.total_sockets} sockets",
        f"**Shortfall:** {result.shortfall} sockets",
        f"**Total CAPEX:** GBP {result.total_capex:,.0f}",
        "",
        "## Regional Capacity Utilization",
        "",
        "| Region | Utilization % | Priority |",
        "|--------|--------------|----------|",
    ]

    region_map = {r["region_code"]: r for r in regions_data}
    for code, util in sorted(result.capacity_utilization.items(), key=lambda x: x[1], reverse=True):
        r = region_map.get(code, {})
        priority = r.get("priority", "?")
        contractors = r.get("contractors", "?")
        lines.append(f"| {code} | {util:.1f}% | {priority}/10 (contractors: {contractors}) |")

    lines.extend([
        "",
        "## Monthly Allocation (sockets per region per month)",
        "",
    ])

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

    month_totals = []
    for m in range(1, 13):
        total_for_month = sum(a.planned_sockets for a in result.allocations if a.month == m)
        month_totals.append(str(total_for_month))
    lines.append(f"| **TOTAL** | " + " | ".join(month_totals) + f" | {result.total_sockets} |")

    lines.extend([
        "",
        "## Contingency Allocations",
        "",
    ])

    contingency_allocs = [a for a in result.allocations if a.is_contingency and a.planned_sockets > 0]
    if contingency_allocs:
        lines.append("| Region | Month | Sockets | Source |")
        lines.append("|--------|-------|---------|--------|")
        for a in contingency_allocs:
            source = a.contingency_source_region or "redistribution"
            lines.append(f"| {a.region_code} | M{a.month} | {a.planned_sockets} | {source} |")
    else:
        lines.append("No contingency allocations needed - base plan meets target.")

    return "\n".join(lines)


FOLLOWUP_SYSTEM_PROMPT = """You are an expert EV charging infrastructure planning analyst for the UK market.

You previously provided an analysis of a fiscal year deployment plan. The plan summary and your original analysis are provided below. Answer follow-up questions about this plan with specific, data-backed answers. Reference the plan data when possible.

## Plan Summary
{plan_summary}

## Your Original Analysis
{original_analysis}
"""



def build_plan_summary_from_db(plan) -> str:
    """Build a plan summary string from the FiscalPlan ORM object (no SolverResult needed)."""
    total_sockets = sum(a.planned_sockets for a in plan.allocations)
    total_capex = sum(a.capex for a in plan.allocations)
    shortfall = max(0, plan.target_sockets - total_sockets)

    lines = [
        "# Fiscal Year Plan Summary",
        "",
        f"**Target:** {plan.target_sockets} sockets",
        f"**Achieved:** {total_sockets} sockets",
        f"**Shortfall:** {shortfall} sockets",
        f"**Total CAPEX:** GBP {total_capex:,.0f}",
        "",
        "## Regional Capacity Utilization",
        "",
        "| Region | Utilization % | Priority |",
        "|--------|--------------|----------|",
    ]

    for r in plan.regions:
        region_sockets = sum(a.planned_sockets for a in plan.allocations if a.region_code == r.region_code)
        base_cap = r.contractors * r.max_sites_per_team_per_month
        annual_cap = base_cap * 12 * plan.avg_sockets_per_site
        util = (region_sockets / annual_cap * 100) if annual_cap > 0 else 0
        lines.append(f"| {r.region_code} | {util:.1f}% | {r.priority}/10 (contractors: {r.contractors}) |")

    lines.extend(["", "## Monthly Allocation (sockets per region per month)", ""])

    region_codes = sorted(set(a.region_code for a in plan.allocations))
    header = "| Region | " + " | ".join(f"M{m}" for m in range(1, 13)) + " | Total |"
    sep = "|--------|" + "|".join("------" for _ in range(12)) + "|-------|"
    lines.append(header)
    lines.append(sep)

    for code in region_codes:
        monthly = {a.month: a.planned_sockets for a in plan.allocations if a.region_code == code}
        cells = [str(monthly.get(m, 0)) for m in range(1, 13)]
        total = sum(monthly.values())
        lines.append(f"| {code} | " + " | ".join(cells) + f" | {total} |")

    month_totals = []
    for m in range(1, 13):
        total_for_month = sum(a.planned_sockets for a in plan.allocations if a.month == m)
        month_totals.append(str(total_for_month))
    lines.append(f"| **TOTAL** | " + " | ".join(month_totals) + f" | {total_sockets} |")

    return "\n".join(lines)



def run_followup_chat(
    plan_summary_text: str,
    original_analysis: str,
    question: str,
    history: list[dict],
) -> str:
    """Multi-turn conversation about a plan's contingency analysis."""
    is_valid, error_message = validate_foundry_settings()
    if not is_valid:
        return f"**AI chat unavailable:** {error_message}"

    transcript_lines = []
    for msg in history[-10:]:
        transcript_lines.append(f"{msg['role'].upper()}: {msg['content']}")
    transcript_lines.append(f"USER: {question}")

    prompt = "\n\n".join(transcript_lines)
    system = FOLLOWUP_SYSTEM_PROMPT.format(
        plan_summary=plan_summary_text,
        original_analysis=original_analysis or "(No analysis generated yet)",
    )

    settings = get_foundry_settings()
    try:
        return _run_foundry_response(prompt, system, min(settings["max_tokens"], 2048))
    except Exception as e:
        logger.error(f"AI followup chat failed: {e}")
        return f"**Error:** {str(e)}"

