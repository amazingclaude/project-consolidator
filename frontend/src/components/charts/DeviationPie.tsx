import { useMemo, useCallback, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { CHART_PALETTE } from '../../lib/colors';

interface DeviationPieProps {
  data: Record<string, number>;
  title: string;
  colorMap?: Record<string, string>;
  onSliceClick?: (key: string) => void;
}

interface PieDataEntry {
  key: string;
  name: string;
  value: number;
  fill: string;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PieDataEntry }>;
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900">{entry.name}</p>
      <p className="text-gray-600">
        Count: <span className="font-medium text-gray-900">{entry.value}</span>
      </p>
    </div>
  );
}

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: PieDataEntry;
  percent: number;
  value: number;
}

function ActiveShape(props: ActiveShapeProps) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 10}
        outerRadius={outerRadius + 14}
        fill={fill}
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="#111827"
        fontSize={14}
        fontWeight={600}
      >
        {payload.name}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="#6b7280"
        fontSize={12}
      >
        {value} ({(percent * 100).toFixed(1)}%)
      </text>
    </g>
  );
}

interface RenderLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  value: number;
}

function renderLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  value,
}: RenderLabelProps) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {value}
    </text>
  );
}

export function DeviationPie({
  data,
  title,
  colorMap,
  onSliceClick,
}: DeviationPieProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const entries: PieDataEntry[] = useMemo(() => {
    const keys = Object.keys(data).filter((k) => data[k] > 0);
    return keys.map((key, i) => ({
      key,
      name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: data[key],
      fill: colorMap?.[key] ?? CHART_PALETTE[i % CHART_PALETTE.length],
    }));
  }, [data, colorMap]);

  const handleSliceClick = useCallback(
    (_: unknown, index: number) => {
      if (onSliceClick) {
        onSliceClick(entries[index].key);
      }
    },
    [entries, onSliceClick]
  );

  const handleMouseEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No data available for {title}.
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-gray-700 text-center mb-2">
        {title}
      </h3>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={entries}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={100}
              dataKey="value"
              nameKey="name"
              {...({ activeIndex } as any)}
              activeShape={ActiveShape as any}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleSliceClick}
              cursor={onSliceClick ? 'pointer' : 'default'}
              label={renderLabel as any}
              labelLine={false}
            >
              {entries.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type { DeviationPieProps };
