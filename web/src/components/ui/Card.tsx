/**
 * Card — glass surface container. The base for ALL panels in the app.
 * Variants: default / elev-2 / aq-card / hero-greeting
 *
 * Variants are intentional: default is most panels, elev-2 for active/highlighted,
 * aq-card for status-emphasized panels (AQI, Pi stats), hero-greeting for Overview hero.
 *
 * All variants share the glass 3-piece (blur / 1px border / inset shadow) and
 * add semantic colors / gradients on top.
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'elev-2' | 'aq-card' | 'hero-greeting';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** When true, no padding — caller is laying out a chart or grid inside. */
  flush?: boolean;
  children?: ReactNode;
}

const VARIANT_STYLES: Record<CardVariant, CSSProperties> = {
  default: {
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: 'var(--shadow-2), var(--shadow-inset)',
  },
  'elev-2': {
    background: 'var(--glass-2)',
    border: '1px solid var(--glass-border-strong)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: 'var(--shadow-2), var(--shadow-inset)',
  },
  'aq-card': {
    background: 'linear-gradient(160deg, var(--ok-tint) 0%, var(--glass-1) 60%)',
    border: '1px solid var(--ok-border)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: 'var(--shadow-2), var(--shadow-inset), 0 0 24px var(--ok-glow)',
  },
  'hero-greeting': {
    background:
      'linear-gradient(135deg, rgba(167,139,250,0.20) 0%, rgba(244,114,182,0.12) 50%, rgba(103,232,249,0.10) 100%)',
    border: '1px solid var(--glass-border-strong)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: 'var(--shadow-3), var(--shadow-inset)',
  },
};

export function Card({
  variant = 'default',
  flush = false,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const combined: CSSProperties = {
    borderRadius: 'var(--r-lg)',
    padding: flush ? 0 : 24,
    color: 'var(--ink)',
    transition: 'all var(--dur-base) var(--ease-standard)',
    ...VARIANT_STYLES[variant],
    ...style,
  };
  return (
    <div {...rest} className={className} style={combined}>
      {children}
    </div>
  );
}