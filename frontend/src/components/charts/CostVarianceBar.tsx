import { useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { COLORS } from '../../lib/colors';

interface CostVarianceDataPoint {
  name: string;
  variance: number;
  id?: number;
}

interface CostVarianceBarProps {
  data: CostVarianceDataPoint[];
  onBarClick?: (id: number) => void;
}

function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1_000_000) {
    return `${sign}$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${sign}$${(value / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCurrencyFull(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface VarianceTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CostVarianceDataPoint }>;
}

function VarianceTooltip({ active, payload }: VarianceTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  const isPositive = entry.variance >= 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900 mb-1">{entry.name}</p>
      <p className="text-gray-600">
        Variance:{' '}
        <span
          className="font-medium"
          style={{ color: isPositive ? COLORS.green : COLORS.red }}
        >
          {formatCurrencyFull(entry.variance)}
        </span>
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {isPositive ? 'Under budget' : 'Over budget'}
      </p>
    </div>
  );
}

export function CostVarianceBar({ data, onBarClick }: CostVarianceBarProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => a.variance - b.variance),
    [data]
  );

  const chartHeight = useMemo(
    () => Math.max(300, sorted.length * 40),
    [sorted.length]
  );

  const handleClick = useCallback(
    (_data: unknown, index: number) => {
      const entry = sorted[index];
      if (entry.id !== undefined && onBarClick) {
        onBarClick(entry.id);
      }
    },
    [sorted, onBarClick]
  );

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No cost variance data available.
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 10, right: 40, bottom: 10, left: 120 }}
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

          <ReferenceLine x={0} stroke={COLORS.grey} strokeWidth={1.5} />

          <Tooltip content={<VarianceTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />

          <Bar
            dataKey="variance"
            radius={[0, 3, 3, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={handleClick}
          >
            {sorted.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.variance >= 0 ? COLORS.green : COLORS.red}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { CostVarianceBarProps, CostVarianceDataPoint };
