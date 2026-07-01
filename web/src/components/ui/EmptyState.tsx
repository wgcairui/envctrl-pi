/**
 * EmptyState — centered placeholder for "no data yet" panels.
 *
 *   ┌────────────────────┐
 *   │     [icon]         │
 *   │   No devices yet   │
 *   │   Add one to start │
 *   │   [+ Add device]   │
 *   └────────────────────┘
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 12,
        minHeight: 200,
      }}
    >
      {icon && (
        <div style={{ color: 'var(--ink-3)' }}>
          <Icon name={icon} size={48} />
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 320, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}