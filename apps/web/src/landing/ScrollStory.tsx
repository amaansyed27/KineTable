import { useRef } from "react";
import {
  motion,
  useScroll,
  useReducedMotion,
  useTransform,
  useMotionValue,
  useAnimationFrame,
  type MotionValue,
} from "motion/react";
import { Hero } from "./Hero";
import { PersonalTable } from "./PersonalTable";
import { ProductReveal } from "./ProductReveal";
import {
  chapterPositions,
  copyOpacity,
  storyCopy,
  easeRange,
} from "./story.mjs";
function Chapter({
  progress,
  index,
  onClick,
}: {
  progress: MotionValue<number>;
  index: number;
  onClick: () => void;
}) {
  const opacity = useTransform(
    progress,
    (p) => 0.25 + copyOpacity(p, index) * 0.75,
  );
  return (
    <button onClick={onClick} aria-label={storyCopy[index]}>
      <motion.span style={{ opacity }}>0{index + 1}</motion.span>
      <motion.i style={{ opacity }} />
    </button>
  );
}
export function ScrollStory() {
  const target = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start start", "end end"],
  });
  const reduced = !!useReducedMotion();
  // One non-overshooting clock for DOM and 3D; wheel steps settle in ~200ms.
  const progress = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    const raw = scrollYProgress.get();
    const current = progress.get();
    if (Math.abs(raw - current) < 0.00001 && raw === current) return;
    const next = reduced ? raw : current + (raw - current) * (1 - Math.exp(-Math.min(delta, 64) / 65));
    progress.set(Math.abs(raw - next) < 0.00001 ? raw : next);
  });
  const chrome = useTransform(
    progress,
    (p) => easeRange(p, 0.11, 0.19) * (1 - easeRange(p, 0.81, 0.87)),
  );
  const visibility = useTransform(chrome, (o) =>
    o < 0.01 ? "hidden" : "visible",
  );
  function goToStage(index: number) {
    if (target.current)
      window.scrollTo({
        top:
          target.current.offsetTop +
          (target.current.offsetHeight - window.innerHeight) *
            chapterPositions[index],
        behavior: reduced ? "instant" : "smooth",
      });
  }
  return (
    <section
      ref={target}
      className="scroll-experience"
      aria-label="Kinetable interactive product preview"
    >
      <div className="story-pin">
        <Hero progress={progress} reduced={reduced} />
        <motion.div
          className="workbench-frame"
          style={{ opacity: chrome, visibility }}
        >
          <div className="workbench-top">
            <span>
              <b className="mini-mark">k.</b> My table{" "}
              <span className="slash">/</span> Motion alarm
            </span>
            <span>Product preview</span>
          </div>
        </motion.div>
        <ProductReveal progress={progress} />
        <PersonalTable progress={progress} />
        <motion.div
          className="story-controls"
          style={{ opacity: chrome, visibility }}
        >
          <div className="story-steps" aria-label="Preview chapters">
            {storyCopy.map((copy, i) => (
              <Chapter
                key={copy}
                progress={progress}
                index={i}
                onClick={() => goToStage(i)}
              />
            ))}
          </div>
          <span className="scroll-note">Scroll to explore ↓</span>
        </motion.div>
      </div>
      <div id="parts" className="parts-anchor" tabIndex={-1} />
      <div id="product" className="product-anchor" tabIndex={-1} />
    </section>
  );
}
