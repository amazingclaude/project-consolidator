import { useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { COLORS } from '../../lib/colors';

/* Custom tick for angled X-axis labels (Recharts XAxis tick does not accept `angle` directly). */
function AngledXAxisTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  if (!payload) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="end"
        fill="#6b7280"
        fontSize={12}
        transform="rotate(-30)"
      >
        {payload.value}
      </text>
    </g>
  );
}

interface BudgetActualDataPoint {
  name: string;
  budget: number;
  actual: number;
  id?: number;
}

interface BudgetActualBarProps {
  data: BudgetActualDataPoint[];
  onBarClick?: (id: number) => void;
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

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-gray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-medium text-gray-900">{formatCurrencyFull(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function BudgetActualBar({ data, onBarClick }: BudgetActualBarProps) {
  const isHorizontal = data.length > 8;

  const handleClick = useCallback(
    (entry: BudgetActualDataPoint) => {
      if (entry.id !== undefined && onBarClick) {
        onBarClick(entry.id);
      }
    },
    [onBarClick]
  );

  const chartHeight = useMemo(() => {
    if (isHorizontal) {
      return Math.max(300, data.length * 50);
    }
    return 400;
  }, [data.length, isHorizontal]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No budget/actual data available.
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={
            isHorizontal
              ? { top: 10, right: 30, bottom: 10, left: 120 }
              : { top: 10, right: 30, bottom: 40, left: 20 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          {isHorizontal ? (
            <>
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
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="name"
                tick={<AngledXAxisTick />}
                height={60}
                interval={0}
              />
              <YAxis
                type="number"
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
            </>
          )}

          <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: 13 }}
          />

          <Bar
            dataKey="budget"
            name="Budget"
            fill={COLORS.blue}
            radius={[2, 2, 0, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(_data: unknown, index: number) => handleClick(data[index])}
          />
          <Bar
            dataKey="actual"
            name="Actual"
            fill={COLORS.orange}
            radius={[2, 2, 0, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(_data: unknown, index: number) => handleClick(data[index])}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { BudgetActualBarProps, BudgetActualDataPoint };
