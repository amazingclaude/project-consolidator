import { Loader2, Users, Link2, BarChart3, Info } from 'lucide-react';
import { useProject, useIntegrityMetrics } from '../api/projects';
import { MetricCard } from '../components/ui/MetricCard';

interface ResourceWidgetProps {
  projectId: number;
}

export function ResourceWidget({ projectId }: ResourceWidgetProps) {
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(projectId);

  const {
    data: integrity,
    isLoading: integrityLoading,
    error: integrityError,
  } = useIntegrityMetrics(projectId);

  const isLoading = projectLoading || integrityLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if ((projectError && integrityError) || (!project && !integrity)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Failed to load resource data
      </div>
    );
  }

  const totalResources = project?.resource_count ?? integrity?.total_resources ?? 0;
  const totalAssignments = project?.assignment_count ?? integrity?.total_assignments ?? 0;
  const totalTasks = project?.task_count ?? integrity?.total_tasks ?? 0;
  const missingAssignments = integrity?.missing_resource_assignments ?? 0;
  const resourceCoverage = integrity?.resource_coverage ?? null;

  // Calculate assignments per resource ratio
  const assignmentsPerResource =
    totalResources > 0
      ? (totalAssignments / totalResources).toFixed(1)
      : '-';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Total Resources"
          value={totalResources}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Total Assignments"
          value={totalAssignments}
          icon={<Link2 className="h-4 w-4" />}
        />
      </div>

      {/* Allocation overview */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Allocation Summary
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-600">
              <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
              Assignments per Resource
            </span>
            <span className="font-medium text-gray-800">{assignmentsPerResource}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-600">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              Missing Resource Assignments
            </span>
            <span
              className={`font-medium ${
                missingAssignments > 0 ? 'text-orange-600' : 'text-gray-800'
              }`}
            >
              {missingAssignments}
            </span>
          </div>
          {resourceCoverage !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Link2 className="h-3.5 w-3.5 text-gray-400" />
                Resource Coverage
              </span>
              <span className="font-medium text-gray-800">
                {(resourceCoverage * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        {/* Coverage bar */}
        {resourceCoverage !== null && (
          <div className="mt-2.5 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  resourceCoverage >= 0.9
                    ? 'bg-green-500'
                    : resourceCoverage >= 0.7
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(resourceCoverage * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span>
          {totalTasks} tasks across {totalResources} resources with{' '}
          {totalAssignments} assignments
        </span>
      </div>
    </div>
  );
}

export type { ResourceWidgetProps };
