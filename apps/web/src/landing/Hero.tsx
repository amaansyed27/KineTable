import { lazy, Suspense } from "react";
import {
  motion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { storyFrame } from "./story.mjs";
const LandingScene = lazy(() => import("../spatial/LandingScene"));
export function Hero({
  progress,
  reduced,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const opacity = useTransform(progress, (p) => storyFrame(p).hero);
  const copyY = useTransform(progress, (p) => -40 * (1 - storyFrame(p).hero));
  const visibility = useTransform(progress, (p) =>
    p > 0.12 ? "hidden" : "visible",
  );
  return (
    <div className="hero">
      <motion.div
        className="hero-copy"
        style={{ opacity, y: copyY, visibility }}
      >
        <p className="eyebrow">Kinetable · A little possibility.</p>
        <h1>
          Build hardware by
          <br />
          seeing how it works.
        </h1>
        <p className="subcopy">
          Describe an idea. Watch it become something real.
        </p>
        <a className="button" href="/home">
          Open Kinetable <span>↗</span>
        </a>
      </motion.div>
      <div className="hero-scene">
        <Suspense
          fallback={
            <div className="scene-fallback">Setting out a few parts…</div>
          }
        >
          <LandingScene progress={progress} reduced={reduced} />
        </Suspense>
      </div>
      <motion.div className="hero-foot" style={{ opacity, visibility }}>
        <span>Made for curious minds.</span>
        <a href="#product">
          A little scroll. A lot of possibility. <span>↓</span>
        </a>
        <span>01 / The beginning</span>
      </motion.div>
    </div>
  );
}
