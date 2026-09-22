import { lazy, Suspense, useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
const LandingScene = lazy(() => import("../spatial/LandingScene"));
export function FinalCTA() {
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "center center"] });
  const arrival = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const reduced = !!useReducedMotion();
  const y = useTransform(arrival, [0, 1], [reduced ? 0 : 30, 0]);
  return (
    <>
      <section ref={section} className="final-cta">
        <div className="final-board">
          <Suspense fallback={null}>
            <LandingScene mode="final" reduced={reduced} arrival={arrival} />
          </Suspense>
        </div>
        <motion.h2 style={{ y }}>
          Small ideas
          <br />
          become real things.
        </motion.h2>
        <p className="wordmark">Kinetable</p>
        <a className="button" href="#product">
          Open Kinetable <span>→</span>
        </a>
      </section>
      <footer>
        <a className="wordmark" href="#">
          kinetable.
        </a>
        <span>A little closer to something real.</span>
        <span>© {new Date().getFullYear()} Kinetable</span>
      </footer>
    </>
  );
}
