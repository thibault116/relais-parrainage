/** Shared motion rules. No animation callback changes application state or money. */
export const motionTiming = {
  quick: 120,
  ui: 220,
  panel: 320,
  scene: 700,
  ease: "cubic-bezier(.22,1,.36,1)",
} as const;
export const clamp = (n: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, n));
export function sceneFrame(index: number, progress: number, compact = false) {
  const distance = clamp(index - progress, -2, 2),
    focus = clamp(1 - Math.abs(distance));
  return {
    opacity: focus,
    transform: `perspective(1200px) translate3d(${distance * (compact ? 20 : 65)}px,${distance * (compact ? 32 : 70)}px,${-Math.abs(distance) * 80}px) rotateY(${distance * (compact ? -4 : -13)}deg) rotateZ(${distance * 3}deg) scale(${0.92 + focus * 0.08})`,
  };
}
export function appendedMessageIds(
  previous: readonly string[],
  current: readonly string[],
) {
  if (!previous.length) return [];
  const last = current.indexOf(previous[previous.length - 1]);
  return last < 0
    ? []
    : current.slice(last + 1).filter((id) => !previous.includes(id));
}
type Measure = () => void | (() => void);
const readers = new Set<Measure>();
let frame = 0;
const update = () => {
  frame = 0;
  const writes = [...readers].map((read) => read());
  writes.forEach((write) => write?.());
};
const schedule = () => {
  if (!frame) frame = requestAnimationFrame(update);
};
/** One passive scroll listener, read all layouts before any animation writes. */
export function subscribeMotionFrame(read: Measure) {
  if (!readers.size) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  readers.add(read);
  schedule();
  return () => {
    readers.delete(read);
    if (!readers.size) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
