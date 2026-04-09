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
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import {
  useDNORegions,
  useFiscalPlan,
  useCreatePlan,
  useUpdatePlan,
} from '../api/planning';
import { postApi, putApi } from '../api/client';
import type { PlanRegionInput, FiscalPlanDetail, CustomRegionInput } from '../api/types';
import HierarchyEditor from '../components/planning/HierarchyEditor';
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
  const [optimizing, setOptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dno' | 'hierarchy'>('hierarchy');
  const [hierarchy, setHierarchy] = useState<CustomRegionInput[]>([]);

  // Initialize from existing plan or defaults — always show all 14 DNO regions
  useEffect(() => {
    if (!dnoRegions) return;

    if (isEdit && existingPlan) {
      setName(existingPlan.name);
      setFiscalYear(existingPlan.fiscal_year);
      setTargetSockets(existingPlan.target_sockets);
      setAvgSocketsPerSite(existingPlan.avg_sockets_per_site);
      setContingencyPercent(existingPlan.contingency_percent);
      setNotes(existingPlan.notes || '');

      // Build lookup of saved regions
      const savedMap = new Map(
        existingPlan.regions.map((r) => [r.region_code, r])
      );

      // Merge: use saved values where available, defaults for the rest
      setRegions(dnoRegions.map((dno) => {
        const saved = savedMap.get(dno.code);
        if (saved) {
          return {
            region_code: saved.region_code,
            region_name: saved.region_name,
            priority: saved.priority,
            target_sites: saved.target_sites,
            capex_per_site: saved.capex_per_site,
            contractors: saved.contractors,
            team_size_per_contractor: saved.team_size_per_contractor,
            max_sites_per_team_per_month: saved.max_sites_per_team_per_month,
            lead_time_months: saved.lead_time_months,
            build_time_days: saved.build_time_days,
          };
        }
        return { region_code: dno.code, region_name: dno.name, ...DEFAULT_REGION };
      }));
      setEnabledRegions(new Set(existingPlan.regions.map((r) => r.region_code)));

      // Load hierarchy if it exists
      if (existingPlan.hierarchy && existingPlan.hierarchy.length > 0) {
        setHierarchy(existingPlan.hierarchy.map(cr => ({
          name: cr.name,
          code: cr.code,
          description: cr.description,
          default_capex_bom: cr.default_capex_bom,
          default_capex_dno: cr.default_capex_dno,
          default_capex_survey: cr.default_capex_survey,
          default_capex_council: cr.default_capex_council,
          default_opex: cr.default_opex,
          default_revenue_per_site: cr.default_revenue_per_site,
          councils: cr.councils.map(co => ({
            name: co.name,
            code: co.code,
            contact_info: co.contact_info,
            default_capex_bom: co.default_capex_bom,
            default_capex_dno: co.default_capex_dno,
            default_capex_survey: co.default_capex_survey,
            default_capex_council: co.default_capex_council,
            default_opex: co.default_opex,
            default_revenue_per_site: co.default_revenue_per_site,
            contracts: co.contracts.map(ct => ({
              name: ct.name,
              reference: ct.reference,
              status: ct.status,
              dno_regions: ct.dno_regions,
              contractors: ct.contractors,
              team_size_per_contractor: ct.team_size_per_contractor,
              max_sites_per_team_per_month: ct.max_sites_per_team_per_month,
              lead_time_months: ct.lead_time_months,
              build_time_days: ct.build_time_days,
              target_sites: ct.target_sites,
              priority: ct.priority,
              capex_bom: ct.capex_bom,
              capex_dno: ct.capex_dno,
              capex_survey: ct.capex_survey,
              capex_council: ct.capex_council,
              opex_per_site: ct.opex_per_site,
              revenue_per_site: ct.revenue_per_site,
              redundancy_percent: ct.redundancy_percent,
              contingency_percent: ct.contingency_percent,
            })),
          })),
        })));
        setActiveTab('hierarchy');
      }
    } else if (!isEdit) {
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

  const updateRegion = useCallback((code: string, field: keyof PlanRegionInput, value: number | string) => {
    setRegions((prev) =>
      prev.map((r) => (r.region_code === code ? { ...r, [field]: value } : r))
    );
  }, []);

  const updateRegionCode = useCallback((oldCode: string, newCode: string) => {
    setRegions((prev) =>
      prev.map((r) => (r.region_code === oldCode ? { ...r, region_code: newCode } : r))
    );
    setEnabledRegions((prev) => {
      if (!prev.has(oldCode)) return prev;
      const next = new Set(prev);
      next.delete(oldCode);
      next.add(newCode);
      return next;
    });
    setExpandedRegions((prev) => {
      if (!prev.has(oldCode)) return prev;
      const next = new Set(prev);
      next.delete(oldCode);
      next.add(newCode);
      return next;
    });
  }, []);

  const addCustomRegion = useCallback(() => {
    const id = `CUSTOM_${Date.now()}`;
    const newRegion: PlanRegionInput = {
      region_code: id,
      region_name: 'New Region',
      ...DEFAULT_REGION,
    };
    setRegions((prev) => [...prev, newRegion]);
    setEnabledRegions((prev) => new Set([...prev, id]));
    setExpandedRegions((prev) => new Set([...prev, id]));
  }, []);

  const removeRegion = useCallback((code: string) => {
    setRegions((prev) => prev.filter((r) => r.region_code !== code));
    setEnabledRegions((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
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

  const buildPayload = () => {
    const activeRegions = regions.filter((r) => enabledRegions.has(r.region_code));
    return {
      name,
      fiscal_year: fiscalYear,
      target_sockets: targetSockets,
      avg_sockets_per_site: avgSocketsPerSite,
      contingency_percent: contingencyPercent,
      notes: notes || undefined,
      regions: activeRegions,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    let id: number;
    if (isEdit && planIdNum) {
      await updateMutation.mutateAsync(payload);
      id = planIdNum;
    } else {
      const result = await createMutation.mutateAsync(payload);
      id = result.id;
    }
    // Save hierarchy if on hierarchy tab
    if (activeTab === 'hierarchy' && hierarchy.length > 0) {
      await putApi(`/api/planning/plans/${id}/hierarchy`, { custom_regions: hierarchy });
    }
    navigate(`/planning/${id}`);
  };

  const handleSaveAndOptimize = async () => {
    setOptimizing(true);
    try {
      const payload = buildPayload();
      let id: number;

      if (isEdit && planIdNum) {
        await updateMutation.mutateAsync(payload);
        id = planIdNum;
      } else {
        const result = await createMutation.mutateAsync(payload);
        id = result.id;
      }
      // Save hierarchy if on hierarchy tab
      if (activeTab === 'hierarchy' && hierarchy.length > 0) {
        await putApi(`/api/planning/plans/${id}/hierarchy`, { custom_regions: hierarchy });
      }
      // Optimize
      await postApi<FiscalPlanDetail>(`/api/planning/plans/${id}/optimize`, {});
      navigate(`/planning/${id}`);
    } finally {
      setOptimizing(false);
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

  const isSaving = createMutation.isPending || updateMutation.isPending || optimizing;

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

      {/* Tab selector */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'hierarchy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Contracts & Hierarchy
        </button>
        <button
          onClick={() => setActiveTab('dno')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dno'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          DNO Regions (Legacy)
        </button>
      </div>

      {/* Hierarchy tab */}
      {activeTab === 'hierarchy' && (
        <HierarchyEditor
          hierarchy={hierarchy}
          onChange={setHierarchy}
          dnoRegions={dnoRegions || []}
        />
      )}

      {/* DNO Regions tab (existing region cards) */}
      {activeTab === 'dno' && (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Regions ({enabledRegions.size} of {regions.length} enabled)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={addCustomRegion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Region
            </button>
            <button
              onClick={copyToAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy first region's settings to all
            </button>
          </div>
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
                <button
                  onClick={() => removeRegion(region.region_code)}
                  className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Remove region"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Expanded region details */}
              {isExpanded && isEnabled && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                  {/* Editable region identity */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
                        <Pencil className="h-3 w-3" /> Region Name
                      </label>
                      <input
                        type="text"
                        value={region.region_name}
                        onChange={(e) => updateRegion(region.region_code, 'region_name', e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
                        <Pencil className="h-3 w-3" /> Region Code
                      </label>
                      <input
                        type="text"
                        value={region.region_code}
                        onChange={(e) => updateRegionCode(region.region_code, e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {/* Parameters */}
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
      )}

      {/* Action buttons */}
      <section className="flex items-center gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={!name.trim() || (activeTab === 'dno' && enabledRegions.size === 0) || (activeTab === 'hierarchy' && hierarchy.length === 0) || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {(createMutation.isPending || updateMutation.isPending) && !optimizing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save as Draft
        </button>
        <button
          onClick={handleSaveAndOptimize}
          disabled={!name.trim() || (activeTab === 'dno' && enabledRegions.size === 0) || (activeTab === 'hierarchy' && hierarchy.length === 0) || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {optimizing ? (
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
