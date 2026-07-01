/**
 * Button — 5 variants × 3 sizes × icon support.
 *
 * Variants:
 *  - default: neutral secondary action (glass-1 bg)
 *  - primary: CTA (purple→pink gradient)
 *  - success: confirm / activate (mint→cyan gradient)
 *  - danger: high-risk (reboot, delete)
 *  - ghost: text-only / tag-style
 *
 * Sizes:
 *  - md: 13/18px, default
 *  - sm: 12/12px, compact
 *  - icon: 36×36 round
 *
 * Loading: shows spinner, disables interaction, preserves width.
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'default' | 'primary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'icon';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon — uses IconName from components/ui/Icon. */
  iconLeft?: IconName;
  /** Trailing icon. */
  iconRight?: IconName;
  /** When true, render spinner and ignore clicks (preserves width). */
  loading?: boolean;
  children?: ReactNode;
}

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  md: { padding: '8px 14px', fontSize: 13, height: 36, borderRadius: 'var(--r-sm)' },
  sm: { padding: '6px 10px', fontSize: 12, height: 28, borderRadius: 'var(--r-sm)' },
  icon: { width: 36, height: 36, padding: 0, borderRadius: 10, fontSize: 0 },
};

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  default: {
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border)',
    color: 'var(--ink)',
  },
  primary: {
    background: 'linear-gradient(135deg, rgba(167,139,250,0.45), rgba(244,114,182,0.45))',
    border: '1px solid var(--accent-border)',
    color: 'var(--ink)',
    boxShadow: '0 0 12px var(--accent-glow), var(--shadow-inset)',
  },
  success: {
    background: 'linear-gradient(135deg, rgba(110,231,183,0.35), rgba(103,232,249,0.35))',
    border: '1px solid var(--ok-border)',
    color: 'var(--ink)',
    boxShadow: '0 0 12px var(--ok-glow), var(--shadow-inset)',
  },
  danger: {
    background: 'linear-gradient(135deg, rgba(253,164,175,0.35), rgba(244,114,182,0.35))',
    border: '1px solid var(--crit-border)',
    color: 'var(--ink)',
    boxShadow: '0 0 12px var(--crit-glow), var(--shadow-inset)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--ink-2)',
  },
};

const HOVER_OVERRIDES: Record<ButtonVariant, CSSProperties> = {
  default: { background: 'var(--glass-2)', borderColor: 'var(--glass-border-strong)' },
  primary: {
    background: 'linear-gradient(135deg, rgba(167,139,250,0.65), rgba(244,114,182,0.65))',
  },
  success: {
    background: 'linear-gradient(135deg, rgba(110,231,183,0.55), rgba(103,232,249,0.55))',
  },
  danger: {
    background: 'linear-gradient(135deg, rgba(253,164,175,0.55), rgba(244,114,182,0.55))',
  },
  ghost: { background: 'var(--glass-1)', color: 'var(--ink)' },
};

export function Button({
  variant = 'default',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  onMouseEnter,
  onMouseLeave,
  children,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const computedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    lineHeight: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.55 : 1,
    transition: 'all var(--dur-fast) var(--ease-standard)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    ...SIZE_STYLES[size],
    ...VARIANT_STYLES[variant],
    ...style,
  };

  const iconSize = size === 'sm' ? 12 : size === 'icon' ? 16 : 14;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={computedStyle}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          Object.assign(e.currentTarget.style, HOVER_OVERRIDES[variant]);
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, VARIANT_STYLES[variant]);
        onMouseLeave?.(e);
      }}
    >
      {loading ? (
        <span
          aria-hidden
          style={{
            width: iconSize,
            height: iconSize,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 700ms linear infinite',
          }}
        />
      ) : (
        iconLeft && <Icon name={iconLeft} size={iconSize} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}