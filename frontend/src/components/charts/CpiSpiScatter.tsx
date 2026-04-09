import { useMemo, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Label,
  Cell,
} from 'recharts';
import { COLORS } from '../../lib/colors';

interface CpiSpiDataPoint {
  id: number;
  name: string;
  cpi: number | null;
  spi: number | null;
}

interface CpiSpiScatterProps {
  data: CpiSpiDataPoint[];
  onPointClick?: (id: number) => void;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

interface ScatterTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; cpi: number; spi: number } }>;
}

function ScatterTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900 mb-1">{point.name}</p>
      <p className="text-gray-600">
        CPI: <span className="font-medium text-gray-900">{point.cpi.toFixed(2)}</span>
      </p>
      <p className="text-gray-600">
        SPI: <span className="font-medium text-gray-900">{point.spi.toFixed(2)}</span>
      </p>
    </div>
  );
}

interface CustomLabelProps {
  x?: number;
  y?: number;
  value?: string;
}

function CustomLabel({ x, y, value }: CustomLabelProps) {
  if (x === undefined || y === undefined || !value) return null;
  return (
    <text
      x={x}
      y={y - 10}
      textAnchor="middle"
      fill={COLORS.grey}
      fontSize={11}
      fontWeight={500}
    >
      {truncate(value, 20)}
    </text>
  );
}

export function CpiSpiScatter({ data, onPointClick }: CpiSpiScatterProps) {
  const filtered = useMemo(
    () =>
      data
        .filter(
          (d): d is CpiSpiDataPoint & { cpi: number; spi: number } =>
            d.cpi !== null && d.spi !== null
        )
        .map((d) => ({ ...d, cpi: d.cpi, spi: d.spi })),
    [data]
  );

  const handleClick = useCallback(
    (entry: { id: number }) => {
      onPointClick?.(entry.id);
    },
    [onPointClick]
  );

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No projects with both CPI and SPI data available.
      </div>
    );
  }

  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          {/* Background quadrants */}
          <ReferenceArea
            x1={1}
            x2={2}
            y1={1}
            y2={2}
            fill={COLORS.green}
            fillOpacity={0.06}
          />
          <ReferenceArea
            x1={0}
            x2={1}
            y1={0}
            y2={1}
            fill={COLORS.red}
            fillOpacity={0.06}
          />
          <ReferenceArea
            x1={0}
            x2={1}
            y1={1}
            y2={2}
            fill={COLORS.orange}
            fillOpacity={0.04}
          />
          <ReferenceArea
            x1={1}
            x2={2}
            y1={0}
            y2={1}
            fill={COLORS.orange}
            fillOpacity={0.04}
          />

          <XAxis
            type="number"
            dataKey="cpi"
            domain={[0, 2]}
            tickCount={5}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          >
            <Label
              value="CPI (Cost Performance Index)"
              position="bottom"
              offset={0}
              style={{ fontSize: 12, fill: '#6b7280' }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="spi"
            domain={[0, 2]}
            tickCount={5}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          >
            <Label
              value="SPI (Schedule Performance Index)"
              angle={-90}
              position="left"
              offset={0}
              style={{ fontSize: 12, fill: '#6b7280' }}
            />
          </YAxis>

          <ReferenceLine
            x={1}
            stroke={COLORS.grey}
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          <ReferenceLine
            y={1}
            stroke={COLORS.grey}
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />

          <Tooltip content={<ScatterTooltip />} cursor={false} />

          <Scatter
            data={filtered}
            onClick={handleClick}
            cursor={onPointClick ? 'pointer' : 'default'}
            label={<CustomLabel />}
          >
            {filtered.map((entry) => {
              let fill: string = COLORS.grey;
              if (entry.cpi >= 1 && entry.spi >= 1) fill = COLORS.green;
              else if (entry.cpi < 1 && entry.spi < 1) fill = COLORS.red;
              else fill = COLORS.orange;
              return <Cell key={entry.id} fill={fill} r={7} />;
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { CpiSpiScatterProps, CpiSpiDataPoint };
