export const storyCopy = [
  "Say what you want to make.",
  "Build visually.",
  "See what connects to what.",
  "Understand the idea before the code.",
  "Try it before it becomes real.",
];
export const chapterPositions = [0.23, 0.43, 0.59, 0.73, 0.91].map(p => p * 0.82);
export function easeRange(value, start, end) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
export function copyOpacity(progress, index) {
  const exit = 1 - easeRange(progress, 0.81, 0.87);
  progress = Math.min(1, progress / 0.82);
  const starts = [0.11, 0.32, 0.49, 0.64, 0.79];
  const ends = [0.34, 0.51, 0.66, 0.81, 1.05];
  return (
    exit * easeRange(progress, starts[index], starts[index] + 0.04) *
    (1 - easeRange(progress, ends[index] - 0.04, ends[index]))
  );
}
// Landing choreography only. No electrical or simulation state belongs here.
export function storyFrame(progress) {
  const p = Math.max(0, Math.min(1, progress / 0.82));
  return {
    table: easeRange(progress, 0.86, 0.98),
    wireExit: easeRange(progress, 0.805, 0.85),
    arrival: easeRange(p, 0.025, 0.24),
    hero: 1 - easeRange(p, 0.025, 0.115),
    assembly: easeRange(p, 0.29, 0.47),
    sensor: easeRange(p, 0.28, 0.41),
    buzzer: easeRange(p, 0.34, 0.47),
    wiring: easeRange(p, 0.39, 0.49),
    close: easeRange(p, 0.48, 0.6),
    connection: easeRange(p, 0.5, 0.58),
    logic: easeRange(p, 0.64, 0.71) * (1 - easeRange(p, 0.8, 0.85) * 0.55),
    signal: easeRange(p, 0.82, 0.94),
    release: easeRange(p, 0.95, 1),
  };
}
