/**
 * Pulse — animated status dot for "live" indicators.
 *
 * 3 modes:
 *  - static:  solid color + soft glow (default for stable states)
 *  - breath:  2.5s breathing pulse (ok / connected)
 *  - warn:    1.5s sharper pulse (warning states)
 *  - crit:    1.5s faster pulse with crit glow (offline / danger)
 */
import type { CSSProperties } from 'react';

export type PulseMode = 'static' | 'breath' | 'warn' | 'crit';

interface PulseProps {
  mode?: PulseMode;
  /** Dot color override — defaults to ok/warn/crit palette. */
  color?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const MODE_COLOR: Record<PulseMode, string> = {
  static: 'var(--ok)',
  breath: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
};

const MODE_ANIMATION: Record<PulseMode, string | undefined> = {
  static: undefined,
  breath: 'pulse-breath 2.5s ease-in-out infinite',
  warn: 'pulse-warn 1.5s ease-in-out infinite',
  crit: 'pulse-crit 1.5s ease-in-out infinite',
};

export function Pulse({
  mode = 'static',
  color,
  size = 6,
  className,
  style,
  'aria-label': ariaLabel,
}: PulseProps) {
  const dotColor = color ?? MODE_COLOR[mode];
  return (
    <span
      aria-label={ariaLabel}
      data-testid="pulse"
      data-mode={mode}
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: dotColor,
        boxShadow: `0 0 6px ${dotColor}`,
        animation: MODE_ANIMATION[mode],
        ...style,
      }}
    />
  );
}