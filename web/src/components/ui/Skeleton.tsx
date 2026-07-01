/**
 * Skeleton — loading placeholder with shimmer animation.
 *
 * Variants:
 *  - block: rectangle, defaults to 100% × 16px
 *  - text: short bar for inline placeholders
 *  - circle: avatar / icon placeholder
 */
import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** 'block' | 'text' | 'circle' — controls default shape & radius. */
  variant?: 'block' | 'text' | 'circle';
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height, variant = 'block', className, style }: SkeletonProps) {
  const defaults: CSSProperties =
    variant === 'text'
      ? { width: width ?? '60%', height: height ?? 12, borderRadius: 'var(--r-sm)' }
      : variant === 'circle'
        ? { width: width ?? 32, height: height ?? 32, borderRadius: '50%' }
        : { width: width ?? '100%', height: height ?? 16, borderRadius: 'var(--r-sm)' };

  return (
    <div
      aria-hidden
      data-testid="skeleton"
      data-variant={variant}
      className={className}
      style={{
        background:
          'linear-gradient(90deg, var(--glass-1) 0%, var(--glass-2) 50%, var(--glass-1) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s linear infinite',
        ...defaults,
        ...style,
      }}
    />
  );
}