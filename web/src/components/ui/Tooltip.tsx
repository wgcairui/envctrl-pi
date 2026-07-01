/**
 * Tooltip — hover/focus-activated hint with delay.
 *
 * Mount as wrapper around trigger element. Children render as the trigger;
 * pass `label` for the tooltip text.
 *
 * Default: 100ms show delay, top placement. Position prop for alternatives.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  label: ReactNode;
  placement?: Placement;
  delay?: number;
  children: ReactNode;
}

const PLACEMENT_STYLES: Record<Placement, CSSProperties> = {
  top: { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
  bottom: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
  left: { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  right: { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
};

export function Tooltip({ label, placement = 'top', delay = 100, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    const t = setTimeout(() => setShow(true), delay);
    setTimer(t);
  };

  const handleLeave = () => {
    if (timer) clearTimeout(timer);
    setTimer(null);
    setShow(false);
  };

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
  };

  const bubbleStyle: CSSProperties = {
    position: 'absolute',
    ...PLACEMENT_STYLES[placement],
    padding: '6px 10px',
    background: 'rgba(0,0,0,0.75)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--r-sm)',
    fontSize: 11,
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 50,
    opacity: show ? 1 : 0,
    transform: PLACEMENT_STYLES[placement].transform
      ? `${PLACEMENT_STYLES[placement].transform} translateY(${show ? '0' : '4px'})`
      : undefined,
    transition: 'opacity 150ms var(--ease-standard), transform 150ms var(--ease-standard)',
    boxShadow: 'var(--shadow-1)',
  };

  return (
    <span
      className="tooltip-trigger"
      style={wrapperStyle}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      <span role="tooltip" data-testid="tooltip" style={bubbleStyle}>
        {label}
      </span>
    </span>
  );
}