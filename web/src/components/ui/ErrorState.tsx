/**
 * ErrorState — crit-themed panel with optional Retry button.
 *
 * Use when a query fails or a screen can't render its primary data.
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
}

export function ErrorState({
  title = "Couldn't load",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div
      data-testid="error-state"
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 12,
        minHeight: 200,
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--crit-border)',
        background: 'var(--crit-tint)',
      }}
    >
      <div style={{ color: 'var(--crit)' }}>
        <Icon name="alert-circle" size={48} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--crit)' }}>{title}</div>
      {message && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 320, lineHeight: 1.5 }}>
          {message}
        </div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}