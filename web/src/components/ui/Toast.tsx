/**
 * Toast — auto-dismissing notification with 4 severity variants.
 *
 * Uses a singleton manager pattern: `useToast()` returns `{ success, warn, crit, info }`
 * functions. Toasts are mounted once at the app root via `<ToastViewport />`.
 *
 * Timing:
 *  - info: 2s
 *  - success / warn: 3s
 *  - crit: 5s
 *
 * Animation: spring-in (250ms), fade-out (200ms).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ToastSeverity = 'ok' | 'warn' | 'crit' | 'info';

interface ToastEntry {
  id: string;
  severity: ToastSeverity;
  title: string;
  description?: string;
  /** ms; defaults per severity if undefined. */
  duration?: number;
}

interface ToastContextValue {
  show: (toast: Omit<ToastEntry, 'id'>) => string;
  success: (title: string, description?: string) => string;
  warn: (title: string, description?: string) => string;
  crit: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used within <ToastProvider>');
  return ctx;
}

const SEVERITY_DURATION: Record<ToastSeverity, number> = {
  info: 2000,
  ok: 3000,
  warn: 3000,
  crit: 5000,
};

const SEVERITY_ICON: Record<ToastSeverity, IconName> = {
  ok: 'check-circle',
  warn: 'alert-triangle',
  crit: 'alert-circle',
  info: 'info',
};

const SEVERITY_BAR_COLOR: Record<ToastSeverity, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  info: 'var(--info)',
};

const SEVERITY_TEXT_COLOR: Record<ToastSeverity, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  info: 'var(--info)',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: Omit<ToastEntry, 'id'>): string => {
    idCounter.current += 1;
    const id = `t-${idCounter.current}-${Date.now()}`;
    const entry: ToastEntry = { id, ...toast };
    setItems((cur) => [...cur, entry]);
    return id;
  }, []);

  // Convenience wrappers — only `show` is exposed as `show()` directly,
  // but the wrappers make call sites concise: `toast.success("Saved")`.
  const wrap = (severity: ToastSeverity) => (title: string, description?: string) =>
    show({ severity, title, description });

  const ctxValue: ToastContextValue = {
    show,
    success: wrap('ok'),
    warn: wrap('warn'),
    crit: wrap('crit'),
    info: wrap('info'),
    dismiss,
  };

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

interface ViewportProps {
  items: ToastEntry[];
  onDismiss: (id: string) => void;
}

function ToastViewport({ items, onDismiss }: ViewportProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="toast-viewport"
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {items.map((t) => (
        <ToastItem key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ item, onDismiss }: { item: ToastEntry; onDismiss: (id: string) => void }) {
  const duration = item.duration ?? SEVERITY_DURATION[item.severity];
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exit = setTimeout(() => setExiting(true), duration - 200);
    const remove = setTimeout(() => onDismiss(item.id), duration);
    return () => {
      clearTimeout(exit);
      clearTimeout(remove);
    };
  }, [item.id, duration, onDismiss]);

  const itemStyle: CSSProperties = {
    pointerEvents: 'auto',
    position: 'relative',
    minWidth: 280,
    maxWidth: 380,
    display: 'flex',
    gap: 12,
    padding: '12px 16px 12px 14px',
    background: 'var(--glass-2)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--r-md)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    boxShadow: 'var(--shadow-2), var(--shadow-inset)',
    color: 'var(--ink)',
    animation: exiting
      ? 'toast-out 200ms var(--ease-standard) forwards'
      : 'toast-in 250ms var(--ease-spring)',
    overflow: 'hidden',
  };

  return (
    <div role="status" data-testid="toast" data-severity={item.severity} style={itemStyle}>
      {/* Left severity bar */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: SEVERITY_BAR_COLOR[item.severity],
          boxShadow: `0 0 8px ${SEVERITY_BAR_COLOR[item.severity]}`,
        }}
      />
      <div style={{ color: SEVERITY_TEXT_COLOR[item.severity], paddingTop: 1 }}>
        <Icon name={SEVERITY_ICON[item.severity]} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.title}</div>
        {item.description && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          padding: 2,
          marginTop: -2,
          marginRight: -4,
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}