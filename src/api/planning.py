import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..database.models import (
    FiscalPlan, PlanRegion, PlanMonthlyAllocation,
    PlanCustomRegion, PlanCouncil, PlanContract, PlanContractAllocation,
)
from ..planning.regions import DNO_REGIONS
from ..planning.solver import solve, RegionInput
from ..planning.contingency import run_contingency_analysis, run_followup_chat, build_plan_summary_from_db
from ..planning.aggregator import aggregate_contracts_to_regions, distribute_allocations_to_contracts
from .schemas import (
    DNORegion,
    CreatePlanRequest,
    UpdatePlanRequest,
    UpdateStatusRequest,
    UpdateActualsRequest,
    PlanChatRequest,
    PlanChatResponse,
    FiscalPlanSummary,
    FiscalPlanDetail,
    PlanRegionResponse,
    MonthlyAllocationResponse,
    HierarchyInput,
    CustomRegionResponse,
    CouncilResponse,
    ContractResponse,
    ContractAllocationResponse,
    UpdateContractActualsRequest,
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

    # Check for contracts first (new hierarchy), fall back to legacy regions
    contracts = db.query(PlanContract).filter(
        PlanContract.plan_id == plan_id,
        PlanContract.status == "active",
    ).all()

    contract_dicts = None
    if contracts:
        contract_dicts = []
        for c in contracts:
            contract_dicts.append({
                "id": c.id,
                "status": c.status,
                "dno_regions": c.dno_regions,
                "contractors": c.contractors,
                "team_size_per_contractor": c.team_size_per_contractor,
                "max_sites_per_team_per_month": c.max_sites_per_team_per_month,
                "lead_time_months": c.lead_time_months,
                "build_time_days": c.build_time_days,
                "target_sites": c.target_sites,
                "priority": c.priority,
                "capex_bom": c.capex_bom,
                "capex_dno": c.capex_dno,
                "capex_survey": c.capex_survey,
                "capex_council": c.capex_council,
            })
        region_inputs = aggregate_contracts_to_regions(contract_dicts)
        dno_names = {r["code"]: r["name"] for r in DNO_REGIONS}
        for ri in region_inputs:
            ri.region_name = dno_names.get(ri.region_code, ri.region_code)
    elif plan.regions:
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
    else:
        raise HTTPException(status_code=400, detail="Plan has no regions or contracts configured")

    result = solve(
        regions=region_inputs,
        target_sockets=plan.target_sockets,
        avg_sockets_per_site=plan.avg_sockets_per_site,
        contingency_percent=plan.contingency_percent,
    )

    # Clear old allocations
    db.query(PlanMonthlyAllocation).filter(PlanMonthlyAllocation.plan_id == plan_id).delete()
    db.query(PlanContractAllocation).filter(PlanContractAllocation.plan_id == plan_id).delete()

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

    # Distribute to contracts if hierarchy exists
    if contract_dicts:
        contract_alloc_dicts = distribute_allocations_to_contracts(
            result, contract_dicts, plan.avg_sockets_per_site
        )
        for ca in contract_alloc_dicts:
            db.add(PlanContractAllocation(
                contract_id=ca["contract_id"],
                plan_id=plan_id,
                month=ca["month"],
                planned_sites=ca["planned_sites"],
                planned_sockets=ca["planned_sockets"],
                is_contingency=ca["is_contingency"],
            ))

    regions_data = [
        {
            "region_code": ri.region_code,
            "region_name": ri.region_name,
            "priority": ri.priority,
            "contractors": ri.contractors,
            "capex_per_site": ri.capex_per_site,
        }
        for ri in region_inputs
    ]
    plan.ai_analysis = run_contingency_analysis(result, regions_data)
    plan.status = "optimized"
    plan.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(plan)
    return _plan_to_detail(plan)


@router.put("/plans/{plan_id}/actuals", response_model=FiscalPlanDetail)
def update_actuals(plan_id: int, req: UpdateActualsRequest, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Build lookup of existing allocations
    alloc_map: dict[tuple[str, int], PlanMonthlyAllocation] = {}
    for a in plan.allocations:
        alloc_map[(a.region_code, a.month)] = a

    for entry in req.actuals:
        key = (entry["region_code"], entry["month"])
        if key in alloc_map:
            alloc_map[key].actual_sockets = entry["actual_sockets"]

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


@router.post("/plans/{plan_id}/chat", response_model=PlanChatResponse)
def plan_chat(plan_id: int, req: PlanChatRequest, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.ai_analysis:
        raise HTTPException(status_code=400, detail="Plan has not been optimized yet")

    plan_summary = build_plan_summary_from_db(plan)
    history = [{"role": m.role, "content": m.content} for m in req.history]
    answer = run_followup_chat(plan_summary, plan.ai_analysis, req.question, history)
    return PlanChatResponse(answer=answer)


@router.get("/plans/{plan_id}/hierarchy")
def get_hierarchy(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _build_hierarchy_response(plan)


@router.put("/plans/{plan_id}/hierarchy")
def save_hierarchy(plan_id: int, req: HierarchyInput, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Clear existing hierarchy
    db.query(PlanContractAllocation).filter(PlanContractAllocation.plan_id == plan_id).delete()
    db.query(PlanContract).filter(PlanContract.plan_id == plan_id).delete()
    db.query(PlanCouncil).filter(PlanCouncil.plan_id == plan_id).delete()
    db.query(PlanCustomRegion).filter(PlanCustomRegion.plan_id == plan_id).delete()

    for cr_input in req.custom_regions:
        cr = PlanCustomRegion(
            plan_id=plan_id,
            name=cr_input.name,
            code=cr_input.code,
            description=cr_input.description,
            default_capex_bom=cr_input.default_capex_bom,
            default_capex_dno=cr_input.default_capex_dno,
            default_capex_survey=cr_input.default_capex_survey,
            default_capex_council=cr_input.default_capex_council,
            default_opex=cr_input.default_opex,
            default_revenue_per_site=cr_input.default_revenue_per_site,
        )
        db.add(cr)
        db.flush()

        for co_input in cr_input.councils:
            co = PlanCouncil(
                custom_region_id=cr.id,
                plan_id=plan_id,
                name=co_input.name,
                code=co_input.code,
                contact_info=co_input.contact_info,
                default_capex_bom=co_input.default_capex_bom,
                default_capex_dno=co_input.default_capex_dno,
                default_capex_survey=co_input.default_capex_survey,
                default_capex_council=co_input.default_capex_council,
                default_opex=co_input.default_opex,
                default_revenue_per_site=co_input.default_revenue_per_site,
            )
            db.add(co)
            db.flush()

            for ct_input in co_input.contracts:
                ct = PlanContract(
                    council_id=co.id,
                    plan_id=plan_id,
                    name=ct_input.name,
                    reference=ct_input.reference,
                    status=ct_input.status,
                    dno_regions=json.dumps(ct_input.dno_regions),
                    contractors=ct_input.contractors,
                    team_size_per_contractor=ct_input.team_size_per_contractor,
                    max_sites_per_team_per_month=ct_input.max_sites_per_team_per_month,
                    lead_time_months=ct_input.lead_time_months,
                    build_time_days=ct_input.build_time_days,
                    target_sites=ct_input.target_sites,
                    priority=ct_input.priority,
                    capex_bom=ct_input.capex_bom,
                    capex_dno=ct_input.capex_dno,
                    capex_survey=ct_input.capex_survey,
                    capex_council=ct_input.capex_council,
                    opex_per_site=ct_input.opex_per_site,
                    revenue_per_site=ct_input.revenue_per_site,
                    redundancy_percent=ct_input.redundancy_percent,
                    contingency_percent=ct_input.contingency_percent,
                )
                db.add(ct)

    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _build_hierarchy_response(plan)


@router.put("/plans/{plan_id}/contract-actuals")
def update_contract_actuals(plan_id: int, req: UpdateContractActualsRequest, db: Session = Depends(get_db)):
    plan = db.query(FiscalPlan).filter(FiscalPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    for entry in req.actuals:
        alloc = db.query(PlanContractAllocation).filter(
            PlanContractAllocation.plan_id == plan_id,
            PlanContractAllocation.contract_id == entry["contract_id"],
            PlanContractAllocation.month == entry["month"],
        ).first()
        if alloc:
            alloc.actual_sockets = entry["actual_sockets"]

    _rollup_contract_actuals_to_dno(plan, db)
    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _plan_to_detail(plan)


def _rollup_contract_actuals_to_dno(plan: FiscalPlan, db: Session):
    """Roll up contract-level actuals to DNO-level monthly allocations."""
    contract_allocs = db.query(PlanContractAllocation).filter(
        PlanContractAllocation.plan_id == plan.id,
        PlanContractAllocation.actual_sockets.isnot(None),
    ).all()

    if not contract_allocs:
        return

    contracts = db.query(PlanContract).filter(PlanContract.plan_id == plan.id).all()
    contract_dnos: dict[int, list[str]] = {}
    for c in contracts:
        try:
            contract_dnos[c.id] = json.loads(c.dno_regions) if c.dno_regions else []
        except (json.JSONDecodeError, TypeError):
            contract_dnos[c.id] = []

    dno_month_actuals: dict[tuple[str, int], int] = {}
    for ca in contract_allocs:
        if ca.actual_sockets is None:
            continue
        dnos = contract_dnos.get(ca.contract_id, [])
        n = len(dnos) if dnos else 1
        per_dno = round(ca.actual_sockets / n)
        for dno in dnos:
            key = (dno, ca.month)
            dno_month_actuals[key] = dno_month_actuals.get(key, 0) + per_dno

    for (dno, month), actual in dno_month_actuals.items():
        alloc = db.query(PlanMonthlyAllocation).filter(
            PlanMonthlyAllocation.plan_id == plan.id,
            PlanMonthlyAllocation.region_code == dno,
            PlanMonthlyAllocation.month == month,
        ).first()
        if alloc:
            alloc.actual_sockets = actual


def _build_hierarchy_response(plan: FiscalPlan) -> list:
    """Build hierarchy response from ORM relationships."""
    result = []
    for cr in plan.custom_regions:
        councils = []
        for co in cr.councils:
            contracts = []
            for ct in co.contracts:
                try:
                    dno_list = json.loads(ct.dno_regions) if ct.dno_regions else []
                except (json.JSONDecodeError, TypeError):
                    dno_list = []
                contracts.append(ContractResponse(
                    id=ct.id, council_id=ct.council_id, plan_id=ct.plan_id,
                    name=ct.name, reference=ct.reference, status=ct.status,
                    dno_regions=dno_list,
                    contractors=ct.contractors,
                    team_size_per_contractor=ct.team_size_per_contractor,
                    max_sites_per_team_per_month=ct.max_sites_per_team_per_month,
                    lead_time_months=ct.lead_time_months, build_time_days=ct.build_time_days,
                    target_sites=ct.target_sites, priority=ct.priority,
                    capex_bom=ct.capex_bom, capex_dno=ct.capex_dno,
                    capex_survey=ct.capex_survey, capex_council=ct.capex_council,
                    opex_per_site=ct.opex_per_site, revenue_per_site=ct.revenue_per_site,
                    redundancy_percent=ct.redundancy_percent, contingency_percent=ct.contingency_percent,
                ))
            councils.append(CouncilResponse(
                id=co.id, custom_region_id=co.custom_region_id, plan_id=co.plan_id,
                name=co.name, code=co.code, contact_info=co.contact_info,
                default_capex_bom=co.default_capex_bom, default_capex_dno=co.default_capex_dno,
                default_capex_survey=co.default_capex_survey, default_capex_council=co.default_capex_council,
                default_opex=co.default_opex, default_revenue_per_site=co.default_revenue_per_site,
                contracts=contracts,
            ))
        result.append(CustomRegionResponse(
            id=cr.id, plan_id=cr.plan_id, name=cr.name, code=cr.code,
            description=cr.description,
            default_capex_bom=cr.default_capex_bom, default_capex_dno=cr.default_capex_dno,
            default_capex_survey=cr.default_capex_survey, default_capex_council=cr.default_capex_council,
            default_opex=cr.default_opex, default_revenue_per_site=cr.default_revenue_per_site,
            councils=councils,
        ))
    return result


def _plan_to_detail(plan: FiscalPlan) -> FiscalPlanDetail:
    """Convert a FiscalPlan ORM object to FiscalPlanDetail response."""
    total_sockets = sum(a.planned_sockets for a in plan.allocations)
    total_capex = sum(a.capex for a in plan.allocations)

    # Compute capacity utilization from allocations
    capacity_utilization: dict[str, float] = {}
    if plan.regions and plan.allocations:
        for r in plan.regions:
            region_sockets = sum(a.planned_sockets for a in plan.allocations if a.region_code == r.region_code)
            # Rough utilization: what fraction of 12 months x capacity was used
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
                actual_sockets=a.actual_sockets,
            )
            for a in plan.allocations
        ],
        total_achieved_sockets=total_sockets,
        total_capex=total_capex,
        capacity_utilization=capacity_utilization,
        hierarchy=_build_hierarchy_response(plan),
        contract_allocations=[
            ContractAllocationResponse(
                id=ca.id, contract_id=ca.contract_id, plan_id=ca.plan_id,
                month=ca.month, planned_sites=ca.planned_sites,
                planned_sockets=ca.planned_sockets, actual_sockets=ca.actual_sockets,
                is_contingency=ca.is_contingency,
            )
            for cr in plan.custom_regions
            for co in cr.councils
            for ct in co.contracts
            for ca in ct.contract_allocations
        ],
        total_revenue=sum(
            ct.revenue_per_site * ct.target_sites
            for cr in plan.custom_regions for co in cr.councils for ct in co.contracts
        ),
        total_opex=sum(
            ct.opex_per_site * ct.target_sites
            for cr in plan.custom_regions for co in cr.councils for ct in co.contracts
        ),
    )
