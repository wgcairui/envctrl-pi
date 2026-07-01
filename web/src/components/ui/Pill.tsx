/**
 * Pill — status badge. Combines:
 *  - colored dot (mint / amber / pink / sky)
 *  - semantic background + border (12-15% tint, 30% border)
 *  - uppercase 11px Mono label
 *
 * Status semantics:
 *  - ok:    online / good / success / connected
 *  - warn:  warning / drift / elevated
 *  - crit:  critical / offline / danger
 *  - info:  informational / neutral highlight
 *  - dim:   disabled / muted (ink-3)
 */
import type { CSSProperties, ReactNode } from 'react';

export type PillStatus = 'ok' | 'warn' | 'crit' | 'info' | 'dim';

interface PillProps {
  status?: PillStatus;
  /** Optional leading dot — auto-rendered for status !== 'dim' */
  showDot?: boolean;
  /** Pulse variant: 'breath' (ok), 'warn', 'crit', or undefined (static). */
  pulse?: 'breath' | 'warn' | 'crit';
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const STATUS_STYLES: Record<PillStatus, CSSProperties> = {
  ok: {
    color: 'var(--ok)',
    background: 'var(--ok-tint)',
    borderColor: 'var(--ok-border)',
  },
  warn: {
    color: 'var(--warn)',
    background: 'var(--warn-tint)',
    borderColor: 'var(--warn-border)',
  },
  crit: {
    color: 'var(--crit)',
    background: 'var(--crit-tint)',
    borderColor: 'var(--crit-border)',
  },
  info: {
    color: 'var(--info)',
    background: 'var(--info-tint)',
    borderColor: 'var(--info-border)',
  },
  dim: {
    color: 'var(--ink-3)',
    background: 'var(--glass-1)',
    borderColor: 'var(--glass-border)',
  },
};

const STATUS_DOT_COLOR: Record<PillStatus, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  info: 'var(--info)',
  dim: 'var(--ink-4)',
};

const PULSE_ANIMATION: Record<NonNullable<PillProps['pulse']>, string> = {
  breath: 'pulse-breath 2.5s ease-in-out infinite',
  warn: 'pulse-warn 1.5s ease-in-out infinite',
  crit: 'pulse-crit 1.5s ease-in-out infinite',
};

export function Pill({
  status = 'ok',
  showDot = true,
  pulse,
  children,
  className,
  style,
}: PillProps) {
  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: STATUS_DOT_COLOR[status],
    boxShadow: `0 0 6px ${STATUS_DOT_COLOR[status]}`,
    animation: pulse ? PULSE_ANIMATION[pulse] : undefined,
  };

  return (
    <span
      className={className}
      data-status={status}
      data-testid="pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--r-pill)',
        border: '1px solid',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...STATUS_STYLES[status],
        ...style,
      }}
    >
      {showDot && status !== 'dim' && <span aria-hidden style={dotStyle} />}
      {children}
    </span>
  );
}