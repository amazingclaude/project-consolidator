# Fiscal Year Planning Module — Design Document

**Date:** 2026-03-20
**Status:** Approved

## Overview

A new planning module for the Connected Curb portfolio platform that enables fiscal year planning for EV charging socket deployment across UK DNO regions. Users input regional constraints and targets, a hybrid algorithm generates an optimized monthly build plan, and Claude AI provides contingency analysis.

## Architecture: Standalone Planning Domain

New domain alongside existing portfolio/projects/deviations, with its own DB tables, API router, and frontend pages. No modifications to existing code—only additions.

## Data Model

### fiscal_plans

Top-level plan entity.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment |
| name | String | e.g. "FY2026 Socket Rollout Plan v2" |
| fiscal_year | Integer | Calendar year (Jan-Dec) |
| target_sockets | Integer | Overall target for total new sockets |
| status | String | "draft" / "optimized" / "approved" |
| avg_sockets_per_site | Float | Default sockets per site (e.g. 6) |
| contingency_percent | Float | Buffer % (e.g. 10%) |
| ai_analysis | Text | Claude AI contingency analysis (markdown) |
| created_at | DateTime | |
| updated_at | DateTime | |
| notes | Text | Optional free-text |

### plan_regions

Per-region configuration and constraints.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | |
| plan_id | FK → fiscal_plans | |
| region_code | String | DNO region code (e.g. "UKPN_SE") |
| region_name | String | Full name (e.g. "UKPN South Eastern") |
| priority | Integer | Strategic priority 1-10 (10 = highest) |
| target_sites | Integer | Planned number of sites |
| capex_per_site | Float | £ cost per site |
| contractors | Integer | Number of contractors available |
| team_size_per_contractor | Integer | Workers per contractor team |
| max_sites_per_team_per_month | Integer | Build capacity constraint |
| lead_time_months | Integer | Planning/permitting lead time |
| build_time_days | Integer | Average days to build one site |

### plan_monthly_allocations

Generated monthly plan (output of algorithm).

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | |
| plan_id | FK → fiscal_plans | |
| region_code | String | |
| month | Integer | 1-12 |
| planned_sites | Integer | Sites to build this month |
| planned_sockets | Integer | Sockets from those sites |
| cumulative_sockets | Integer | Running total |
| capex | Float | Cost for this month |
| is_contingency | Boolean | True if overflow/redistribution |
| contingency_source_region | String | If contingency, original demand source |

## Hybrid Algorithm

### Phase 1 — Capacity Matrix

For each region r:
- `monthly_capacity[r]` = contractors × max_sites_per_team_per_month
- `monthly_socket_capacity[r]` = monthly_capacity × avg_sockets_per_site
- `available_months[r]` = 12 - lead_time_months
- `max_annual_sockets[r]` = sum of seasonal-adjusted monthly capacities

### Phase 1b — Seasonal Adjustment

Apply seasonal multipliers to monthly capacity:

| Month | Multiplier | Rationale |
|-------|-----------|-----------|
| Jan | 0.5 | Winter, short days |
| Feb | 0.6 | Late winter |
| Mar | 0.8 | Spring mobilization |
| Apr-Sep | 1.0 | Peak construction |
| Oct | 0.9 | Autumn |
| Nov | 0.6 | Winter onset |
| Dec | 0.4 | Holidays, poor weather |

Effective capacity: `monthly_capacity[r][m] = base_capacity[r] × seasonal_multiplier[m]`

### Phase 2 — Priority-Weighted Proportional Allocation

Each region has a priority (1-10). Allocation uses priority-weighted capacity:

```
weighted_capacity[r] = max_annual_sockets[r] × (priority[r] / 10)
base_target[r] = target_sockets × (weighted_capacity[r] / sum(weighted_capacity))
```

High-priority regions get proportionally more allocation relative to capacity.

### Phase 3 — Monthly Scheduling with Ramp-up

For each region, spread base_target across available months:
- Months 1..lead_time_months: 0 sites
- Building month 1: 50% capacity (mobilization)
- Building month 2: 75% capacity
- Building month 3+: 100% capacity

### Phase 4 — Shortfall Redistribution (Contingency)

If sum(base_target) < target_sockets:
1. Identify regions with spare capacity
2. Redistribute shortfall to spare-capacity regions, prioritizing by strategic priority
3. Mark as `is_contingency = True` with source tracking

### Phase 5 — Contingency Buffer

Apply contingency_percent as additional sockets:
- Spread across regions with remaining spare capacity
- Accounts for planning failures, contractor delays, etc.

### Claude AI Analysis (post-solver)

After solver produces base plan, Claude receives the full allocation and generates:
- Risk assessment (regions at capacity, single points of failure)
- Contingency recommendations (which regions absorb shortfall)
- Narrative summary for stakeholders
- Scenario analysis (contractor loss impact)

Stored as markdown in `fiscal_plans.ai_analysis`.

## API Endpoints

Router: `/api/planning/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | List all fiscal plans |
| POST | `/plans` | Create new plan with regions |
| GET | `/plans/{id}` | Get plan with regions & allocations |
| PUT | `/plans/{id}` | Update plan inputs |
| DELETE | `/plans/{id}` | Delete a plan |
| POST | `/plans/{id}/optimize` | Run solver + AI analysis |
| PUT | `/plans/{id}/status` | Update status |
| GET | `/regions` | DNO regions reference data |

## Frontend Pages

### Planning Dashboard (`/planning`)

List of all fiscal plans with name, year, target, status, quick stats. "New Plan" button.

### Plan Input Form (`/planning/new`, `/planning/:planId/edit`)

Top section: plan name, fiscal year, target sockets, avg sockets/site, contingency %.

Region cards (14 DNO regions): each expandable with toggle, priority slider, target sites, CAPEX/site, contractors, team size, max sites/team/month, lead time, build time. "Copy to all" bulk action.

Bottom: "Generate Plan" button.

### Generated Plan View (`/planning/:planId`)

Summary cards: target vs achieved, total CAPEX, peak utilization, contingency sockets.

Monthly allocation heatmap table (regions × months), color-coded by utilization.

Cumulative progress line chart (actual vs target trajectory).

AI analysis panel rendered as markdown.

Actions: Approve, Duplicate & Edit.

## UK DNO Regions (14)

| Code | Name |
|------|------|
| ENWL | Electricity North West |
| NPG_NE | Northern Powergrid North East |
| NPG_YK | Northern Powergrid Yorkshire |
| SPEN_MW | SP Energy Networks Manweb |
| SPEN_D | SP Energy Networks Distribution |
| SSEN_S | SSEN Southern |
| SSEN_N | SSEN North |
| UKPN_SE | UK Power Networks South Eastern |
| UKPN_E | UK Power Networks Eastern |
| UKPN_LPN | UK Power Networks London |
| WPD_SM | WPD South Wales & South West |
| WPD_EM | WPD East Midlands |
| WPD_WM | WPD West Midlands |
| WPD_S | WPD South West |

## Integration Points

- New sidebar entry: "Planning" with calendar icon
- New route in App.tsx router
- Uses existing Anthropic SDK integration for Claude AI analysis
- Uses existing SQLAlchemy session management (get_db dependency)
- Uses existing UI component library (MetricCard, DataTable, charts via Recharts)
- Uses existing Zustand/React Query patterns
