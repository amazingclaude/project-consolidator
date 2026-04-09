import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { COLORS } from '../../lib/colors';

interface EacDataPoint {
  name: string;
  budget: number;
  eac: number;
  cpi: number | null;
}

interface EacWaterfallProps {
  data: EacDataPoint[];
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface EacTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function EacTooltip({ active, payload, label }: EacTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const budgetEntry = payload.find((p) => p.dataKey === 'budget');
  const eacEntry = payload.find((p) => p.dataKey === 'eac');
  const delta =
    budgetEntry && eacEntry ? eacEntry.value - budgetEntry.value : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-gray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-medium text-gray-900">{formatCurrencyFull(entry.value)}</span>
        </p>
      ))}
      {delta !== null && (
        <p className="text-gray-600 mt-1 pt-1 border-t border-gray-100">
          Delta:{' '}
          <span
            className="font-medium"
            style={{ color: delta > 0 ? COLORS.red : COLORS.green }}
          >
            {delta > 0 ? '+' : ''}
            {formatCurrencyFull(delta)}
          </span>
        </p>
      )}
    </div>
  );
}

export function EacWaterfall({ data }: EacWaterfallProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => (b.eac - b.budget) - (a.eac - a.budget)),
    [data]
  );

  const eacColors = useMemo(
    () =>
      sorted.map((entry) =>
        entry.eac > entry.budget ? COLORS.red : COLORS.green
      ),
    [sorted]
  );

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No BAC/EAC data available.
      </div>
    );
  }

  const chartHeight = Math.max(350, sorted.length * 50);

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 10, right: 30, bottom: 10, left: 120 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />

          <XAxis
            type="number"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />

          <Tooltip content={<EacTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: 13 }}
          />

          <Bar
            dataKey="budget"
            name="BAC (Budget at Completion)"
            fill={COLORS.blue}
            radius={[0, 3, 3, 0]}
            barSize={16}
          />
          <Bar
            dataKey="eac"
            name="EAC (Estimate at Completion)"
            radius={[0, 3, 3, 0]}
            barSize={16}
          >
            {sorted.map((_, index) => (
              <Cell key={index} fill={eacColors[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { EacWaterfallProps, EacDataPoint };
