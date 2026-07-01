/**
 * Tabs — segmented control with sliding underline.
 *
 * Container: glass-1 bg, pill border, 3px inner padding.
 * Active: glass-2 bg, ink text, inset highlight.
 * Hover: ink-2 text.
 *
 * Use Tabs for nav-like selectors (Live / History / Control / Diagnostics on
 * Device Detail). Use RangeTabs for time-window pickers (5m / 1h / 24h).
 */
import type { CSSProperties, ReactNode } from 'react';
import { useRef, useState, useEffect, useLayoutEffect } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Stretch tabs evenly (true) or hug content (false). */
  fullWidth?: boolean;
  className?: string;
  'aria-label': string;
}

// useLayoutEffect warns on SSR — guard with typeof window
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  fullWidth = true,
  className,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    const btn = buttonRefs.current[value]
    if (!container || !btn) return
    const containerRect = container.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setIndicator({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
      ready: true,
    })
  }, [value, items])

  const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    padding: 3,
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--r-pill)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: 'var(--shadow-inset)',
  }

  const indicatorStyle: CSSProperties = {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: indicator.left,
    width: indicator.width,
    borderRadius: 'var(--r-pill)',
    background: 'var(--glass-2)',
    boxShadow: 'var(--shadow-inset)',
    transition: 'left var(--dur-base) var(--ease-standard), width var(--dur-base) var(--ease-standard)',
    pointerEvents: 'none',
    opacity: indicator.ready ? 1 : 0,
  }

  return (
    <div ref={containerRef} className={className} role="tablist" aria-label={ariaLabel} style={containerStyle}>
      <div aria-hidden style={indicatorStyle} />
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              buttonRefs.current[item.value] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            data-testid="tab"
            data-active={active || undefined}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: fullWidth ? 1 : '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 16px',
              background: 'transparent',
              border: 'none',
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: 'var(--r-pill)',
              transition: 'color var(--dur-fast) var(--ease-standard)',
            }}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * RangeTabs — compact variant for time-window pickers.
 * Slightly smaller padding, mono font label, no padding inset.
 */
export function RangeTabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--shadow-inset)',
      }}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            data-testid="range-tab"
            data-active={active || undefined}
            style={{
              padding: '4px 12px',
              background: active ? 'var(--glass-2)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all var(--dur-fast) var(--ease-standard)',
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}