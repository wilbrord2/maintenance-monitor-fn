'use client';

import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_CHROME } from '@/constants/chart-colors';
import { ChartTooltip } from './chart-tooltip';

export interface BarChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface BarChartDatum {
  id: string;
  label: string;
  values: Readonly<Record<string, number>>;
}

export interface HorizontalBarChartProps {
  data: readonly BarChartDatum[];
  series: readonly BarChartSeries[];
  formatValue(value: number): string;
  /** Text summary for screen readers; the table view carries every value. */
  summary: string;
  /** Counts: use whole-number axis ticks only. */
  integerValues?: boolean;
}

const ROW_HEIGHT = 34;
const AXIS_BAND = 28;
const BAR_SIZE = 16;
const TOTAL_KEY = '__total';

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Ranked horizontal bars (one series, or a stack with a surface-coloured 2px gap between
 * segments). Thin bars with a rounded data end, hairline grid, totals labelled at the tip.
 */
export default function HorizontalBarChart({ data, series, formatValue, summary, integerValues = false }: HorizontalBarChartProps) {
  const reducedMotion = useReducedMotion();
  const stacked = series.length > 1;
  const lastKey = series[series.length - 1]?.key;
  const rows = data.map((datum) => ({
    label: datum.label,
    ...datum.values,
    [TOTAL_KEY]: series.reduce((sum, item) => sum + (datum.values[item.key] ?? 0), 0),
  }));
  const height = rows.length * ROW_HEIGHT + AXIS_BAND;

  return (
    <div>
      {stacked ? (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary" aria-label="Legend">
          {series.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div role="img" aria-label={summary} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={8} accessibilityLayer={false}>
            <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} />
            <XAxis
              type="number"
              allowDecimals={!integerValues}
              tickLine={false}
              axisLine={{ stroke: CHART_CHROME.axis }}
              tick={{ fill: CHART_CHROME.tick, fontSize: 11 }}
              tickFormatter={(value: number) => formatValue(value)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={136}
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
              tickFormatter={(value: string) => truncate(value, 20)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(27, 36, 48, 0.04)' }}
              content={({ active, payload, label }) =>
                active && payload && payload.length > 0 ? (
                  <ChartTooltip
                    title={String(label)}
                    items={series.map((item) => ({
                      label: item.label,
                      color: item.color,
                      value: formatValue(Number(payload.find((entry) => entry.dataKey === item.key)?.value ?? 0)),
                    }))}
                  />
                ) : null
              }
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId={stacked ? 'stack' : undefined}
                fill={item.color}
                barSize={BAR_SIZE}
                radius={item.key === lastKey ? [0, 4, 4, 0] : 0}
                stroke={stacked ? CHART_CHROME.surface : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={!reducedMotion}
                animationDuration={400}
              >
                {item.key === lastKey ? (
                  <LabelList
                    dataKey={TOTAL_KEY}
                    position="right"
                    fill={CHART_CHROME.tick}
                    fontSize={11}
                    formatter={(value) => (typeof value === 'number' ? formatValue(value) : value)}
                  />
                ) : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
