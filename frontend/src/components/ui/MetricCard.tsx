import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaPositive,
  icon,
  className = '',
}: MetricCardProps) {
  return (
    <div
      className={`bg-card rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted truncate">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            {value}
          </span>
          {delta !== undefined && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                deltaPositive
                  ? 'bg-green-50 text-success'
                  : 'bg-red-50 text-danger'
              }`}
            >
              {delta}
            </span>
          )}
        </div>
      </div>
      {icon && (
        <div className="flex-shrink-0 rounded-lg bg-blue-50 p-2.5 text-primary">
          {icon}
        </div>
      )}
    </div>
  );
}

export type { MetricCardProps };
