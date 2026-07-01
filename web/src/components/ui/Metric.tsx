/**
 * Metric — formatted number with unit + label. Always mono + tabular-nums.
 *
 * Use as the canonical way to render any measurement value:
 *   <Metric value={23.5} unit="°C" label="Temperature" decimals={1} />
 *
 * Decimals: 1 by default (matches spec — "23.5°C" not "23.50").
 * Status colors override the default ink color when value crosses thresholds.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { PulseMode } from './Pulse';

export type MetricStatus = 'normal' | 'warn' | 'crit';

interface MetricProps {
  value: number | null | undefined;
  unit?: string;
  label?: ReactNode;
  decimals?: number;
  /** Optional trend delta to show (e.g. +0.3°C). */
  delta?: number;
  /** Prefix for trend direction. */
  deltaUnit?: string;
  /** Status coloring applied to the value (not the label). */
  status?: MetricStatus;
  /** When true, show a small pulse dot next to the value (live indicator). */
  live?: boolean;
  /** Pulse mode when `live` is true. */
  pulseMode?: PulseMode;
  /** Layout: row (default) or stacked (label on top). */
  layout?: 'row' | 'stack';
  className?: string;
  style?: CSSProperties;
}

const STATUS_COLOR: Record<MetricStatus, string> = {
  normal: 'var(--ink)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
};

function formatNumber(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  // Strip trailing zeros after fixed-decimal formatting
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

function formatDelta(delta: number, unit?: string): { text: string; positive: boolean } {
  const positive = delta >= 0;
  const abs = Math.abs(delta);
  return {
    text: `${positive ? '+' : '-'}${abs.toFixed(1)}${unit ? ` ${unit}` : ''}`,
    positive,
  };
}

export function Metric({
  value,
  unit,
  label,
  decimals = 1,
  delta,
  deltaUnit,
  status = 'normal',
  live = false,
  pulseMode = 'breath',
  layout = 'row',
  className,
  style,
}: MetricProps) {
  const valueStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    color: STATUS_COLOR[status],
    lineHeight: 1.1,
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 4,
  };

  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ink-3)',
  };

  if (layout === 'stack') {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
        {label && <span style={labelStyle}>{label}</span>}
        <span style={{ ...valueStyle, fontSize: 24 }}>
          {formatNumber(value, decimals)}
          {unit && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{unit}</span>
          )}
        </span>
        {typeof delta === 'number' && <DeltaIndicator delta={delta} unit={deltaUnit} />}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        ...style,
      }}
    >
      {label && <span style={labelStyle}>{label}</span>}
      <span style={{ ...valueStyle, fontSize: 14 }}>
        {formatNumber(value, decimals)}
        {unit && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>{unit}</span>}
      </span>
      {typeof delta === 'number' && <DeltaIndicator delta={delta} unit={deltaUnit} />}
    </div>
  );
}

function DeltaIndicator({ delta, unit }: { delta: number; unit?: string }) {
  const { text, positive } = formatDelta(delta, unit);
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontVariantNumeric: 'tabular-nums',
        color: positive ? 'var(--ok)' : 'var(--info)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span>{positive ? '↑' : '↓'}</span>
      <span>{text}</span>
    </span>
  );
}