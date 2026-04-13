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
  Pencil,
  FileText,
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
        <PageHeader title="FY Planning" subtitle="Fiscal year connection planning and plan selection" />
        <LoadingState message="Loading plans..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="FY Planning" subtitle="Fiscal year connection planning and plan selection" />
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
  const totalContracts = plans?.reduce((sum, p) => sum + (p.region_count || 0), 0) ?? 0;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader title="FY Planning" subtitle="Fiscal year connection planning and plan selection" />
        <button
          onClick={() => navigate('/planning/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <MetricCard
          label="Total Contracts"
          value={totalContracts}
          icon={<FileText className="h-5 w-5" />}
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
