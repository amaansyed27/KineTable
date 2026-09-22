import { Group } from "three";
import { useInView, type MotionValue } from "motion/react";
import {
  Suspense,
  useRef,
  Component,
  useLayoutEffect,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { BoardModel } from "./Models";
import { StoryWorld } from "./StoryWorld";
import { SoftShadow, makeShadow } from "./SoftShadow";
import { LearningModel } from "./LearningModel";
export type SceneMode = "final" | "learn";
function StaticCamera({ mode }: { mode: SceneMode }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    camera.zoom =
      (mode === "learn" ? 2.05 : 2.7) *
      Math.min(
        1,
        size.width / (mode === "learn" ? 430 : 400),
      );
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate, mode]);
  return null;
}
function SceneArrival({ arrival, reduced, children }: { arrival?: MotionValue<number>; reduced: boolean; children: ReactNode }) {
  const group = useRef<Group>(null);
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => arrival?.on("change", invalidate), [arrival, invalidate]);
  useFrame(() => {
    if (!group.current) return;
    const remaining = reduced ? 0 : 1 - (arrival?.get() ?? 1);
    group.current.rotation.y = remaining * -0.16;
    group.current.position.y = remaining * -0.65;
  });
  return <group ref={group}>{children}</group>;
}
function StillLife() {
  const shadow = useMemo(makeShadow, []);
  return <>
    <group rotation={[0, -0.4, 0]}><BoardModel /></group>
    <SoftShadow texture={shadow} scale={[2, 3]} height={-0.45} />
  </>;
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        ESP32 → motion sensor → buzzer
        <br />
        <small>The interactive 3D preview needs WebGL.</small>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function LandingScene({
  mode = "final",
  reduced = false,
  progress,
  arrival,
  connected = false,
  onConnect = () => {},
}: {
  mode?: SceneMode;
  reduced?: boolean;
  progress?: MotionValue<number>;
  arrival?: MotionValue<number>;
  connected?: boolean;
  onConnect?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const shadow = useMemo(makeShadow, []);
  const visible = useInView(container);
  const entered = useInView(container, { once: true, margin: "200px" });
  return (
    <div ref={container} className="canvas-container">
      <SceneBoundary>
        {entered && (
          <Canvas
            frameloop={progress && visible && !reduced ? "always" : "demand"}
            dpr={[1, 1.5]}
            camera={{ position: [6, 8.5, 10], fov: 32 }}
            gl={{ antialias: true, alpha: true }}
            aria-hidden={progress || mode !== "learn" ? true : undefined}
          >
            <Suspense fallback={null}>
              <Environment resolution={128} frames={1}>
                <Lightformer
                  position={[-3, 5, 2]}
                  rotation={[Math.PI / 2, 0, 0]}
                  scale={[8, 8, 1]}
                  intensity={2}
                  color="#fffdf5"
                />
                <Lightformer
                  position={[4, 2, 1]}
                  rotation={[0, -Math.PI / 2, 0]}
                  scale={[5, 7, 1]}
                  intensity={1.2}
                  color="#e9f0e5"
                />
              </Environment>
              {progress ? (
                <StoryWorld progress={progress} reduced={reduced} />
              ) : (
                <>
                  <StaticCamera mode={mode} />
                  <ambientLight intensity={1.8} />
                  <directionalLight position={[-3, 8, 5]} intensity={3} />
                  <directionalLight position={[5, 3, -3]} intensity={1} />
                  <SceneArrival arrival={arrival} reduced={reduced}>
                  {mode === "learn" ? (
                    <>
                      <LearningModel
                        connected={connected}
                        reduced={reduced}
                        onConnect={onConnect}
                      />
                      <SoftShadow texture={shadow} scale={[2.8, 3.8]} height={-0.12} />
                    </>
                  ) : (
                    <StillLife />
                  )}
                  </SceneArrival>
                </>
              )}
            </Suspense>
          </Canvas>
        )}
      </SceneBoundary>
    </div>
  );
}
