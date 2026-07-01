/**
 * Icon — unified icon component backed by a small in-house SVG sprite.
 *
 * Why no lucide-react? We ship a curated set of stroke-2 icons inline so we
 * don't add a runtime dep. All icons share the same stroke / linecap / linejoin.
 * stroke="currentColor" so color follows text via Tailwind or `style={{ color }}`.
 *
 * To add a new icon: append a <path> block, give it a name in `IconName`, and
 * add the path data here.
 */
import type { CSSProperties } from 'react';

export type IconName =
  | 'check'
  | 'check-circle'
  | 'x'
  | 'alert-triangle'
  | 'alert-circle'
  | 'info'
  | 'cpu'
  | 'thermometer'
  | 'droplet'
  | 'wind'
  | 'sun'
  | 'eye'
  | 'cog'
  | 'power'
  | 'refresh'
  | 'search'
  | 'plus'
  | 'minus'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-up-right'
  | 'arrow-down-right'
  | 'wifi'
  | 'wifi-off'
  | 'activity'
  | 'zap'
  | 'lock'
  | 'unlock'
  | 'message'
  | 'message-circle'
  | 'send'
  | 'terminal'
  | 'database'
  | 'hard-drive'
  | 'shield'
  | 'sparkles'
  | 'git-branch'
  | 'clock'
  | 'trash'
  | 'edit'
  | 'download'
  | 'upload'
  | 'play'
  | 'pause'
  | 'copy'
  | 'home'
  | 'bell'
  | 'list'
  | 'trending-up'
  | 'trending-down';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

/**
 * Icon path data — each entry is the inner JSX (children) for a 24x24 viewBox.
 * Keep stroke-width consistent (2). Use `currentColor` so color follows text.
 */
const ICON_PATHS: Record<IconName, JSX.Element> = {
  check: <path d="M5 12l5 5L20 7" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  'alert-triangle': (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  'alert-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  cpu: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </>
  ),
  thermometer: (
    <>
      <path d="M14 14V5a2 2 0 10-4 0v9a4 4 0 105 0z" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3l-6 8a6 6 0 0012 0l-6-8z" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h12a3 3 0 100-6" />
      <path d="M3 16h16a3 3 0 110 6" />
      <path d="M3 12h9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  power: (
    <>
      <path d="M12 2v10" />
      <path d="M5.6 6.6a8 8 0 1012.8 0" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0115.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  minus: (
    <>
      <path d="M5 12h14" />
    </>
  ),
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'arrow-up': (
    <>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 5v14" />
      <path d="M5 12l7 7 7-7" />
    </>
  ),
  'arrow-up-right': (
    <>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  'arrow-down-right': (
    <>
      <path d="M7 7l10 10" />
      <path d="M17 8v9h-9" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 8a16 16 0 0120 0" />
      <path d="M5 12a12 12 0 0114 0" />
      <path d="M8.5 15.5a8 8 0 017 0" />
      <circle cx="12" cy="19" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M2 8a16 16 0 014-3.5" />
      <path d="M18 4.5A16 16 0 0122 8" />
      <path d="M5 12a12 12 0 014-2.5" />
      <path d="M15 9.5A12 12 0 0119 12" />
      <path d="M8.5 15.5a8 8 0 011-0.5" />
      <path d="M14.5 15a8 8 0 012 1.5" />
      <circle cx="12" cy="19" r="0.5" fill="currentColor" stroke="none" />
      <path d="M3 3l18 18" />
    </>
  ),
  activity: <path d="M3 12h4l3-9 4 18 3-9h4" />,
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  unlock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 017.5-2" />
    </>
  ),
  message: (
    <>
      <path d="M21 11.5a8.4 8.4 0 01-1 4 8.5 8.5 0 01-7.5 4.5 8.4 8.4 0 01-4-1L3 21l2-5.5a8.4 8.4 0 01-1-4 8.5 8.5 0 014.5-7.5 8.4 8.4 0 014-1h.5a8.5 8.5 0 018 8v.5z" />
    </>
  ),
  'message-circle': (
    <>
      <path d="M21 11.5a8.4 8.4 0 01-1 4 8.5 8.5 0 01-7.5 4.5 8.4 8.4 0 01-4-1L3 21l2-5.5a8.4 8.4 0 01-1-4 8.5 8.5 0 014.5-7.5 8.4 8.4 0 014-1h.5a8.5 8.5 0 018 8v.5z" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  terminal: (
    <>
      <path d="M4 17l5-5-5-5" />
      <path d="M12 19h8" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5" />
      <path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </>
  ),
  'hard-drive': (
    <>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <circle cx="7" cy="7" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  shield: <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z" />,
  sparkles: (
    <>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l0.5 1.5L21 16l-1.5 0.5L19 18l-0.5-1.5L17 16l1.5-0.5L19 14z" />
    </>
  ),
  'git-branch': (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="9" r="2" />
      <path d="M6 8v8" />
      <path d="M18 11c0 4-6 4-6 7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </>
  ),
  play: <path d="M6 4l14 8-14 8V4z" />,
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </>
  ),
  home: (
    <>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2z" />
      <path d="M10 21a2 2 0 004 0" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  'trending-up': (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  'trending-down': (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M14 17h7v-7" />
    </>
  ),
};

export function Icon({ name, size = 16, className, style, 'aria-label': ariaLabel }: IconProps) {
  const computedStyle: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    ...style,
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={computedStyle}
      className={className}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      aria-hidden={ariaLabel ? undefined : true}
      data-testid={`icon-${name}`}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}