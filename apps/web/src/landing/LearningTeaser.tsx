import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { lazy, Suspense, useState, useRef } from "react";
const LandingScene = lazy(() => import("../spatial/LandingScene"));
export function LearningTeaser() {
  const section = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const { scrollYProgress: sceneProgress } = useScroll({ target: scene, offset: ["start end", "center center"] });
  const reduced = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "start start"] });
  const arrival = useTransform(scrollYProgress, [0.1, 0.85], [0, 1]);
  const copyY = useTransform(arrival, [0, 1], [reduced ? 0 : 38, 0]);
  const copyOpacity = useTransform(arrival, [0, 0.7], [reduced ? 1 : 0.35, 1]);
  const [connected, setConnected] = useState(false);
  return (
    <section ref={section} id="learn" className="learning">
      <motion.div className="learning-copy" style={{ y: copyY, opacity: copyOpacity }}>
        <p className="eyebrow">A little nudge. Then that little “oh.”</p>
        <h2>
          Learn by
          <br />
          making
          <br />
          things work.
        </h2>
      </motion.div>
      <div className="learning-demo">
        <div className="lesson-title">
          <h3>Make the LED turn on.</h3>
          <button
            onClick={() => setConnected(false)}
            disabled={!connected}
            aria-label="Reset the LED lesson"
          >
            Reset ↺
          </button>
        </div>
        <div
          ref={scene}
        className="learning-scene"
          role="group"
          aria-label="An interactive breadboard with an LED, resistor, and missing ground connection"
        >
          <Suspense fallback={null}>
            <LandingScene
              mode="learn"
              arrival={sceneProgress}
              reduced={reduced}
              connected={connected}
              onConnect={() => setConnected(!connected)}
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
