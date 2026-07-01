/**
 * Chip — filter / toggle pill with optional count badge.
 *
 * Used in Devices page for status filtering, channel picker etc.
 *  - default: glass-1 bg, ink-3 text
 *  - on:      accent-tint bg, accent border, ink text
 *  - off-active (warning): warn-tint bg when filter matches warning state
 */
import type { CSSProperties, ReactNode } from 'react';

interface ChipProps {
  active?: boolean;
  /** Optional count badge (number rendered after label). */
  count?: number;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Aria label for icon-only chip — required for accessibility. */
  'aria-label'?: string;
}

export function Chip({
  active = false,
  count,
  onClick,
  children,
  className,
  style,
  'aria-label': ariaLabel,
}: ChipProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 'var(--r-pill)',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all var(--dur-fast) var(--ease-standard)',
    border: '1px solid',
    userSelect: 'none',
  };

  const colors: CSSProperties = active
    ? {
        background: 'var(--accent-tint)',
        borderColor: 'var(--accent-border)',
        color: 'var(--ink)',
      }
    : {
        background: 'var(--glass-1)',
        borderColor: 'var(--glass-border)',
        color: 'var(--ink-3)',
      };

  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      aria-label={ariaLabel}
      data-active={active || undefined}
      data-testid="chip"
      className={className}
      style={{ ...base, ...colors, ...style }}
    >
      {children}
      {typeof count === 'number' && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontVariantNumeric: 'tabular-nums',
            padding: '1px 6px',
            borderRadius: 'var(--r-pill)',
            background: active ? 'var(--accent-glow)' : 'var(--glass-2)',
            color: active ? 'var(--ink)' : 'var(--ink-3)',
          }}
        >
          {count}
        </span>
      )}
    </Component>
  );
}