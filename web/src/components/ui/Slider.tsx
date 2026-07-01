/**
 * Slider — range input with mono number readout and unit suffix.
 *
 * Style: native range slider with custom track + thumb (no extra dep).
 *  - track: glass-1 bg, 4px height, glass border
 *  - thumb: 16px round, purple-pink gradient with accent-glow on hover
 *
 * Hover/active scale handled via CSS in animations.css / inline.
 */
import type { CSSProperties, ChangeEvent } from 'react';

/** Trim trailing zeros after fixed-decimal formatting — matches Metric component. */
function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Decimal places for the read-out. */
  decimals?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  'aria-label': string;
  id?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  unit,
  decimals = 1,
  disabled = false,
  onChange,
  'aria-label': ariaLabel,
  id,
}: SliderProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value));

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    height: 16,
  };

  const readoutStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink)',
    minWidth: 64,
    textAlign: 'right',
  };

  const cssVars: CSSProperties = {};

  return (
    <div style={wrapperStyle}>
      <style>{SLIDER_CSS}</style>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handle}
        aria-label={ariaLabel}
        data-testid="slider"
        style={inputStyle}
      />
      <span aria-live="polite" style={readoutStyle}>
        {formatNumber(value, decimals)}
        {unit && <span style={{ color: 'var(--ink-3)', marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  );
}

/**
 * Scoped stylesheet for the range thumb. Loaded once per Slider mount —
 * acceptable for the handful of sliders in the app; a real production app
 * would hoist this into the global stylesheet.
 */
const SLIDER_CSS = `
.envctrl-slider,
input[type="range"][data-testid="slider"] {
  background: transparent;
}
input[type="range"][data-testid="slider"]::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--glass-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-pill);
}
input[type="range"][data-testid="slider"]::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chart-1), var(--hot));
  border: 1px solid var(--glass-border-strong);
  margin-top: -7px;
  cursor: pointer;
  box-shadow: 0 0 6px var(--accent-glow);
  transition: transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
input[type="range"][data-testid="slider"]:hover::-webkit-slider-thumb {
  transform: scale(1.15);
  box-shadow: 0 0 12px rgba(167,139,250,0.7);
}
input[type="range"][data-testid="slider"]:active::-webkit-slider-thumb {
  transform: scale(1.25);
}
input[type="range"][data-testid="slider"]::-moz-range-track {
  height: 4px;
  background: var(--glass-1);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-pill);
}
input[type="range"][data-testid="slider"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chart-1), var(--hot));
  border: 1px solid var(--glass-border-strong);
  cursor: pointer;
  box-shadow: 0 0 6px var(--accent-glow);
  transition: transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
input[type="range"][data-testid="slider"]:hover::-moz-range-thumb {
  transform: scale(1.15);
  box-shadow: 0 0 12px rgba(167,139,250,0.7);
}
`;