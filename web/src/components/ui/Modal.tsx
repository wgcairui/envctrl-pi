/**
 * Modal — accessible dialog with backdrop blur + spring entry.
 *
 * Mounts a portal-free overlay (just position: fixed). Locks body scroll while open.
 * Closes on Esc, backdrop click (unless `static`), and explicit Close button.
 *
 * Use `danger` variant for destructive confirms (Restore / Reboot).
 */
import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** When true, backdrop click is ignored (only Esc / Close button). */
  staticBackdrop?: boolean;
  /** Width in px; defaults 480. */
  width?: number;
  /** When true, applies crit border + crit glow to header. */
  danger?: boolean;
}

const SIZE = { width: 480 };

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  staticBackdrop = false,
  width = SIZE.width,
  danger = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'backdrop-in 200ms var(--ease-standard)',
  };

  const contentStyle: CSSProperties = {
    width,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
    background: 'var(--glass-2)',
    border: danger ? '1px solid var(--crit-border)' : '1px solid var(--glass-border-strong)',
    borderRadius: 'var(--r-xl)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: danger
      ? 'var(--shadow-3), var(--shadow-inset), 0 0 24px var(--crit-glow)'
      : 'var(--shadow-3), var(--shadow-inset)',
    color: 'var(--ink)',
    animation: 'modal-in 250ms var(--ease-spring)',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '20px 24px 14px',
    borderBottom: '1px solid var(--glass-border)',
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (staticBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      role="presentation"
      data-testid="modal-backdrop"
      onClick={onBackdropClick}
      style={backdropStyle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-testid="modal"
        data-danger={danger || undefined}
        style={contentStyle}
      >
        <header style={headerStyle}>
          {danger && (
            <span style={{ color: 'var(--crit)' }}>
              <Icon name="alert-triangle" size={20} />
            </span>
          )}
          <h2
            id="modal-title"
            style={{
              flex: 1,
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              fontWeight: 600,
              color: danger ? 'var(--crit)' : 'var(--ink)',
            }}
          >
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </Button>
        </header>
        {(description || children) && (
          <div style={{ padding: '16px 24px' }}>
            {description && (
              <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5 }}>
                {description}
              </p>
            )}
            {children}
          </div>
        )}
        {footer && (
          <footer
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              padding: '14px 24px 20px',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}