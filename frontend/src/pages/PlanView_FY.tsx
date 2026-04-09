import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ComposedChart,
  Line,
  Bar,
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
  CheckCircle2,
  Loader2,
  Sparkles,
  Save,
  Send,
  MessageSquare,
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFiscalPlan, useOptimizePlan, useUpdatePlanStatus, useUpdateActuals } from '../api/planning';
import { postApi } from '../api/client';
import type { UpdateActualsEntry } from '../api/types';
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

function formatCost(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'Which region is most at risk of delays?',
  'What if we lose a contractor in the busiest region?',
  'Summarize the key risks in two bullet points',
];

function PlanViewFY() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const planIdNum = planId ? parseInt(planId, 10) : undefined;

  const { data: plan, isLoading, error, refetch } = useFiscalPlan(planIdNum);
  const optimizeMutation = useOptimizePlan(planIdNum ?? 0);
  const statusMutation = useUpdatePlanStatus(planIdNum ?? 0);
  const actualsMutation = useUpdateActuals(planIdNum ?? 0);

  // Actuals editing state
  const [editedActuals, setEditedActuals] = useState<Record<string, number>>({});
  const [actualsEdited, setActualsEdited] = useState(false);

  // Heatmap view mode
  const [heatmapView, setHeatmapView] = useState<'dno' | 'contract'>('dno');

  // Region filter state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleActualChange = useCallback((regionCode: string, month: number, value: string) => {
    const num = parseInt(value, 10);
    setEditedActuals((prev) => ({ ...prev, [`${regionCode}-${month}`]: isNaN(num) ? 0 : num }));
    setActualsEdited(true);
  }, []);

  const handleSaveActuals = useCallback(() => {
    if (!plan) return;
    const entries: UpdateActualsEntry[] = [];
    for (const [key, value] of Object.entries(editedActuals)) {
      const [regionCode, monthStr] = key.split('-');
      entries.push({ region_code: regionCode, month: parseInt(monthStr, 10), actual_sockets: value });
    }
    if (entries.length > 0) {
      actualsMutation.mutate({ actuals: entries }, {
        onSuccess: () => {
          setActualsEdited(false);
          refetch();
        },
      });
    }
  }, [editedActuals, plan, actualsMutation, refetch]);

  const sendChatMessage = useCallback(async (question: string) => {
    if (!question.trim() || chatLoading || !planIdNum) return;
    const userMsg: ChatMsg = { role: 'user', content: question.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const resp = await postApi<{ answer: string }>(
        `/api/planning/plans/${planIdNum}/chat`,
        { question: question.trim(), history: chatMessages },
      );
      setChatMessages((prev) => [...prev, { role: 'assistant', content: resp.answer }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `**Error:** ${err instanceof Error ? err.message : 'Unknown error'}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages, chatLoading, planIdNum]);

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

  // Region filter logic
  const regionCodes = [...new Set(plan.allocations.map((a) => a.region_code))].sort();
  const filteredAllocations = selectedRegions.length === 0
    ? plan.allocations
    : plan.allocations.filter((a) => selectedRegions.includes(a.region_code));

  // Scale target proportionally when filtering
  const totalPlanned = plan.allocations.reduce((s, a) => s + a.planned_sockets, 0);
  const selectedPlanned = filteredAllocations.reduce((s, a) => s + a.planned_sockets, 0);
  const targetShare = totalPlanned > 0 ? selectedPlanned / totalPlanned : 1;
  const scaledTarget = Math.round(plan.target_sockets * (selectedRegions.length === 0 ? 1 : targetShare));
  const monthlyTarget = scaledTarget / 12;

  // Build chart data with cumulative lines + monthly bars
  let cumPlanned = 0;
  let cumActual = 0;
  const cumulativeData = MONTH_LABELS.map((label, i) => {
    const monthNum = i + 1;
    const monthPlanned = filteredAllocations
      .filter((a) => a.month === monthNum)
      .reduce((sum, a) => sum + a.planned_sockets, 0);
    const monthActual = filteredAllocations
      .filter((a) => a.month === monthNum)
      .reduce((sum, a) => sum + a.actual_sockets, 0);
    cumPlanned += monthPlanned;
    cumActual += monthActual;
    const targetCum = Math.round(monthlyTarget * monthNum);
    return {
      month: label,
      target: targetCum,
      planned: cumPlanned,
      actual: cumActual > 0 ? cumActual : undefined,
      monthlyPlanned: monthPlanned,
      monthlyActual: monthActual > 0 ? monthActual : undefined,
    };
  });
  const hasActuals = cumulativeData.some((d) => d.actual !== undefined);

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

      {/* Cost breakdown summary cards (contract hierarchy) */}
      {hasAllocations && plan.hierarchy.length > 0 && (() => {
        const allContracts = plan.hierarchy.flatMap(cr => cr.councils.flatMap(co => co.contracts));
        const totalBom = allContracts.reduce((s, c) => s + c.capex_bom * c.target_sites, 0);
        const totalDnoCost = allContracts.reduce((s, c) => s + c.capex_dno * c.target_sites, 0);
        const totalSurvey = allContracts.reduce((s, c) => s + c.capex_survey * c.target_sites, 0);
        const totalCouncilCost = allContracts.reduce((s, c) => s + c.capex_council * c.target_sites, 0);
        const netCost = plan.total_capex - plan.total_revenue;

        return (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">BOM Cost</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{'\u00A3'}{formatCost(totalBom)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">DNO Cost</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{'\u00A3'}{formatCost(totalDnoCost)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Survey Cost</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{'\u00A3'}{formatCost(totalSurvey)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Council Cost</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{'\u00A3'}{formatCost(totalCouncilCost)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total Revenue</p>
              <p className="mt-1 text-lg font-semibold text-green-700">{'\u00A3'}{formatCost(plan.total_revenue)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Net (CAPEX - Revenue)</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: netCost >= 0 ? '#dc2626' : '#16a34a' }}>
                {'\u00A3'}{formatCost(Math.abs(netCost))}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Cumulative progress chart with region filter and variance bars */}
      {hasAllocations && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cumulative Socket Deployment</h2>

          {/* Region filter pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm font-medium text-gray-600">Filter:</span>
            <button
              onClick={() => setSelectedRegions([])}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedRegions.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Regions
            </button>
            {regionCodes.map((code) => (
              <button
                key={code}
                onClick={() =>
                  setSelectedRegions((prev) =>
                    prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedRegions.includes(code)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Cumulative', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Monthly', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#6b7280' } }}
                />
                <Tooltip />
                <Legend />
                <ReferenceLine yAxisId="left" y={scaledTarget} stroke="#ef4444" strokeDasharray="5 5" label="Year Target" />

                {/* Monthly bars (right Y-axis) */}
                <Bar yAxisId="right" dataKey="monthlyPlanned" name="Monthly Planned" fill="#93c5fd" opacity={0.6} barSize={20} />
                {hasActuals && (
                  <Bar yAxisId="right" dataKey="monthlyActual" name="Monthly Actual" fill="#6ee7b7" opacity={0.7} barSize={20} />
                )}

                {/* Cumulative lines (left Y-axis) */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="target"
                  name="Target (Linear)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="planned"
                  name="Resource-Planned"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
                {hasActuals && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="actual"
                    name="Actually Built"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', r: 5 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Monthly allocation heatmap */}
      {hasAllocations && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Monthly Allocation (Sockets)</h2>
            {actualsEdited && (
              <button
                onClick={handleSaveActuals}
                disabled={actualsMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300 transition-colors"
              >
                {actualsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Actuals
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-600">View:</span>
            <button
              onClick={() => setHeatmapView('dno')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                heatmapView === 'dno' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              By DNO Region
            </button>
            <button
              onClick={() => setHeatmapView('contract')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                heatmapView === 'contract' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              By Contract
            </button>
          </div>

          {/* DNO Region heatmap */}
          {heatmapView === 'dno' && (
            <>
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
                      const monthMap: Record<number, { sockets: number; actual: number; contingency: boolean }> = {};
                      regionAllocs.forEach((a) => {
                        monthMap[a.month] = { sockets: a.planned_sockets, actual: a.actual_sockets, contingency: a.is_contingency };
                      });
                      const total = regionAllocs.reduce((sum, a) => sum + a.planned_sockets, 0);
                      const totalActual = regionAllocs.reduce((sum, a) => sum + a.actual_sockets, 0);
                      const util = plan.capacity_utilization[code] ?? 0;

                      return (
                        <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-gray-900 whitespace-nowrap">
                            {regionNames[code] || code}
                          </td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const cell = monthMap[m];
                            const sockets = cell?.sockets ?? 0;
                            const actual = editedActuals[`${code}-${m}`] ?? cell?.actual ?? 0;
                            const isContingency = cell?.contingency ?? false;
                            return (
                              <td key={m} className="text-center py-1 px-1">
                                {sockets > 0 ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span
                                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                        isContingency ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {sockets}
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={actual}
                                      onChange={(e) => handleActualChange(code, m, e.target.value)}
                                      className="w-12 rounded border border-gray-200 px-1 py-0.5 text-xs text-center text-green-700 bg-green-50 focus:border-green-400 focus:outline-none"
                                      title="Actual sockets built"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center py-2 px-3">
                            <div className="flex flex-col items-center">
                              <span className="font-semibold text-gray-900">{total}</span>
                              {totalActual > 0 && <span className="text-xs text-green-700">{totalActual}</span>}
                            </div>
                          </td>
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
                      <td className="py-2 px-3 text-gray-900">Total Planned</td>
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
                    {/* Actuals totals row */}
                    <tr className="bg-green-50 font-semibold">
                      <td className="py-2 px-3 text-green-800">Total Actual</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const monthActualTotal = plan.allocations
                          .filter((a) => a.month === m)
                          .reduce((sum, a) => sum + (editedActuals[`${a.region_code}-${m}`] ?? a.actual_sockets), 0);
                        return (
                          <td key={m} className="text-center py-2 px-2 text-green-800">
                            {monthActualTotal || '-'}
                          </td>
                        );
                      })}
                      <td className="text-center py-2 px-3 text-green-800">
                        {plan.allocations.reduce((sum, a) => sum + (editedActuals[`${a.region_code}-${a.month}`] ?? a.actual_sockets), 0)}
                      </td>
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
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-green-50 border border-green-300" /> Actual sockets built
                </span>
              </div>
            </>
          )}

          {/* Contract heatmap */}
          {heatmapView === 'contract' && (
            <>
              {plan.hierarchy.length > 0 ? (() => {
                // Build contract name lookup from hierarchy
                const contractNames: Record<number, string> = {};
                plan.hierarchy.forEach((cr) =>
                  cr.councils.forEach((co) =>
                    co.contracts.forEach((ct) => {
                      contractNames[ct.id] = ct.name;
                    })
                  )
                );

                // Group contract_allocations by contract_id
                const contractGroups: Record<number, typeof plan.contract_allocations> = {};
                plan.contract_allocations.forEach((ca) => {
                  if (!contractGroups[ca.contract_id]) contractGroups[ca.contract_id] = [];
                  contractGroups[ca.contract_id].push(ca);
                });

                const contractIds = Object.keys(contractGroups).map(Number).sort((a, b) => a - b);

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Contract</th>
                          {MONTH_LABELS.map((m) => (
                            <th key={m} className="text-center py-2 px-2 font-medium text-gray-700 w-16">{m}</th>
                          ))}
                          <th className="text-center py-2 px-3 font-medium text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractIds.map((contractId) => {
                          const allocs = contractGroups[contractId];
                          const monthMap: Record<number, number> = {};
                          allocs.forEach((a) => {
                            monthMap[a.month] = (monthMap[a.month] ?? 0) + a.planned_sockets;
                          });
                          const total = allocs.reduce((sum, a) => sum + a.planned_sockets, 0);

                          return (
                            <tr key={contractId} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium text-gray-900 whitespace-nowrap">
                                {contractNames[contractId] || `Contract #${contractId}`}
                              </td>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                const sockets = monthMap[m] ?? 0;
                                const isContingency = allocs.some((a) => a.month === m && a.is_contingency);
                                return (
                                  <td key={m} className="text-center py-1 px-1">
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
                              <td className="text-center py-2 px-3">
                                <span className="font-semibold text-gray-900">{total}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                          <td className="py-2 px-3 text-gray-900">Total</td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const monthTotal = plan.contract_allocations
                              .filter((a) => a.month === m)
                              .reduce((sum, a) => sum + a.planned_sockets, 0);
                            return (
                              <td key={m} className="text-center py-2 px-2 text-gray-900">
                                {monthTotal || '-'}
                              </td>
                            );
                          })}
                          <td className="text-center py-2 px-3 text-gray-900">
                            {plan.contract_allocations.reduce((sum, a) => sum + a.planned_sockets, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })() : (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm text-gray-500">No contract hierarchy configured for this plan.</p>
                </div>
              )}
            </>
          )}
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

      {/* Conversational AI Chat */}
      {plan.ai_analysis && (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Ask Follow-up Questions</h2>
          </div>

          {/* Messages area */}
          <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
            {chatMessages.length === 0 && !chatLoading && (
              <div className="text-center py-6">
                <Sparkles className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 mb-3">Ask questions about your plan's contingency analysis</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendChatMessage(prompt)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-100 px-6 py-3">
            {chatMessages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendChatMessage(prompt)}
                    disabled={chatLoading}
                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage(chatInput);
                  }
                }}
                placeholder="Ask about risks, scenarios, or regions..."
                disabled={chatLoading}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              />
              <button
                onClick={() => sendChatMessage(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
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
