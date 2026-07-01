/**
 * envctrl · Aurora background — fixed full-viewport gradient + drifting orbs.
 * Mount once at the app root, behind everything else (z-index: -1).
 *
 * 3 orbs run on different keyframe paths so they don't sync up.
 * prefers-reduced-motion is handled in animations.css.
 */

const ORB_STYLES = [
  {
    className: 'orb orb-1',
    style: {
      width: 480,
      height: 480,
      top: '-10%',
      left: '-10%',
      background: 'radial-gradient(circle, rgba(244, 114, 182, 0.6) 0%, transparent 70%)',
      animation: 'orb-drift-1 18s ease-in-out infinite',
    },
  },
  {
    className: 'orb orb-2',
    style: {
      width: 520,
      height: 520,
      top: '40%',
      right: '-15%',
      background: 'radial-gradient(circle, rgba(103, 232, 249, 0.5) 0%, transparent 70%)',
      animation: 'orb-drift-2 22s ease-in-out infinite',
    },
  },
  {
    className: 'orb orb-3',
    style: {
      width: 600,
      height: 600,
      bottom: '-15%',
      left: '20%',
      background: 'radial-gradient(circle, rgba(167, 139, 250, 0.55) 0%, transparent 70%)',
      animation: 'orb-drift-3 26s ease-in-out infinite',
    },
  },
] as const;

export function Aurora() {
  return (
    <div
      aria-hidden="true"
      data-testid="aurora"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 30%, var(--bg-3) 60%, var(--bg-4) 90%)',
      }}
    >
      {ORB_STYLES.map((orb, i) => (
        <div
          key={i}
          className={orb.className}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            filter: 'blur(80px)',
            pointerEvents: 'none',
            ...orb.style,
          }}
        />
      ))}
    </div>
  );
}