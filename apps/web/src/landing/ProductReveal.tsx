import { motion, useTransform, type MotionValue } from "motion/react";
import { copyOpacity, storyCopy, easeRange } from "./story.mjs";
function Statement({
  progress,
  index,
}: {
  progress: MotionValue<number>;
  index: number;
}) {
  const opacity = useTransform(progress, (p) => copyOpacity(p, index));
  const y = useTransform(opacity, (o) => (1 - o) * 12);
  const visibility = useTransform(opacity, (o) =>
    o < 0.01 ? "hidden" : "visible",
  );
  return (
    <motion.h2 style={{ opacity, y, visibility }}>{storyCopy[index]}</motion.h2>
  );
}
export function ProductReveal({ progress }: { progress: MotionValue<number> }) {
  const promptOpacity = useTransform(
    progress,
    (p) => easeRange(p / 0.82, 0.17, 0.22) * (1 - easeRange(p / 0.82, 0.3, 0.34)),
  );
  const promptY = useTransform(promptOpacity, (o) => 16 * (1 - o));
  return (
    <div className="product-reveal">
      <div className="story-heading">
        {storyCopy.map((copy, i) => (
          <Statement key={copy} progress={progress} index={i} />
        ))}
      </div>
      <motion.div
        className="prompt"
        style={{ opacity: promptOpacity, y: promptY }}
      >
        <span className="prompt-icon">↳</span>
        <span>Make a motion alarm.</span>
        <span className="prompt-enter">↵</span>
        <p>Using parts you already own.</p>
      </motion.div>
    </div>
  );
}
