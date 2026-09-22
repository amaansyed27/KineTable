import { motion, useTransform, type MotionValue } from "motion/react";
import { easeRange } from "./story.mjs";
export function PersonalTable({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, p => easeRange(p, 0.86, 0.94));
  const y = useTransform(opacity, o => (1 - o) * 22);
  const visibility = useTransform(opacity, o => o < 0.01 ? "hidden" : "visible");
  return <motion.div className="personal-story" style={{ opacity, y, visibility }}>
    <p className="eyebrow">Already yours. Full of possibility.</p>
    <h2>Your parts.<br />Your table.</h2>
    <p className="subcopy">Kinetable remembers what you own<br />and builds around it.</p>
    <div className="recommendation"><span className="recommend-icon">↗</span><div>Motion alarm<small>Everything required <span>✓</span></small></div></div>
  </motion.div>;
}
