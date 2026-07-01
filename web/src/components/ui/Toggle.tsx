/**
 * Toggle — slide switch with LED-on flash on enable.
 *
 * Defaults:
 *  - 40 × 22 size
 *  - off: glass-1 bg, gray thumb
 *  - on:  mint→cyan gradient, white thumb with glow
 *
 * Animation: thumb position 200ms standard easing.
 * LED flash: 600ms one-shot pulse on transition to on.
 * Accessibility: aria-checked, role="switch", Space toggles.
 */
import type { CSSProperties, KeyboardEvent } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Aria label — required when there's no associated text. */
  'aria-label': string;
  className?: string;
  id?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  className,
  id,
}: ToggleProps) {
  const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const trackStyle: CSSProperties = {
    position: 'relative',
    width: 40,
    height: 22,
    borderRadius: 'var(--r-pill)',
    background: checked
      ? 'linear-gradient(135deg, var(--ok), var(--cyan))'
      : 'var(--glass-1)',
    border: checked ? '1px solid transparent' : '1px solid var(--glass-border)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-base) var(--ease-standard)',
    flexShrink: 0,
    padding: 0,
  };

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: checked ? 20 : 2,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: checked ? '#ffffff' : 'var(--ink-3)',
    boxShadow: checked ? '0 0 6px rgba(255,255,255,0.5)' : 'none',
    transition: 'all var(--dur-base) var(--ease-standard)',
    animation: checked ? 'led-on 600ms var(--ease-out)' : undefined,
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKey}
      data-testid="toggle"
      data-checked={checked || undefined}
      className={className}
      style={trackStyle}
    >
      <span aria-hidden style={thumbStyle} />
    </button>
  );
}