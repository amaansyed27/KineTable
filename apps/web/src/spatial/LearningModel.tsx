import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "motion/react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, MeshStandardMaterial } from "three";
import { easeRange } from "../landing/story.mjs";
import { Html, Line } from "@react-three/drei";
import { BreadboardModel } from "./Models";
import { Wire } from "./Wire";
const unlit = new Color("#91a17c");
const lit = new Color("#b7f000");
const supply: [number, number, number][] = [
  [-0.9, 0.14, -1],
  [-1.15, 0.7, -0.8],
  [-0.9, 0.7, -0.4],
  [-0.65, 0.16, -0.4],
];
const ground: [number, number, number][] = [
  [0.48, 0.16, 0.03],
  [0.92, 0.52, 0.3],
  [0.92, 0.45, 0.95],
  [0.9, 0.14, 1.17],
];
export function LearningModel({
  connected,
  reduced,
  onConnect,
}: {
  connected: boolean;
  reduced: boolean;
  onConnect: () => void;
}) {
  const connection = useMotionValue(connected ? 1 : 0);
  const lamp = useRef<MeshStandardMaterial>(null);
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => connection.on("change", invalidate), [connection, invalidate]);
  useEffect(() => {
    const playback = animate(connection, connected ? 1 : 0, { duration: reduced ? 0 : 0.65, ease: "easeInOut" });
    return () => playback.stop();
  }, [connected, reduced, connection]);
  useFrame(() => {
    if (!lamp.current) return;
    const power = easeRange(connection.get(), 0.88, 1);
    lamp.current.color.copy(unlit).lerp(lit, power);
    lamp.current.emissiveIntensity = power * 0.6;
  });
  return (
    <group rotation={[0, -0.15, 0]}>
      <BreadboardModel />
      <Wire points={supply} color="#b17f54" />
      <group position={[-0.2, 0.35, -0.4]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.085, 0.085, 0.55, 20]} />
          <meshStandardMaterial color="#c6b38e" roughness={0.85} />
        </mesh>
        {[-0.15, -0.04, 0.07, 0.2].map((p, i) => (
          <mesh key={p} position={[0, p, 0]}>
            <cylinderGeometry args={[0.087, 0.087, 0.035, 20]} />
            <meshStandardMaterial
              color={["#9a4940", "#9a4940", "#684c37", "#b9a263"][i]}
            />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[0.018, 0.018, 1.04, 8]} />
          <meshStandardMaterial
            color="#aaa994"
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
      </group>
      {[-0.72, 0.32].map(x => <mesh key={x} position={[x, 0.235, -0.4]}>
        <cylinderGeometry args={[0.018, 0.018, 0.23, 8]} />
        <meshStandardMaterial color="#aaa994" metalness={0.6} roughness={0.35} />
      </mesh>)}
      <group position={[0.38, 0.18, -0.23]}>
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, 0.14, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
            <meshStandardMaterial color="#9a9d89" metalness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.31, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.1, 28]} />
          <meshStandardMaterial
            color={connected ? "#aed84b" : "#899974"}
            roughness={0.45}
          />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <capsuleGeometry args={[0.14, 0.2, 6, 20]} />
          <meshStandardMaterial
            ref={lamp}
            color="#91a17c"
            emissive="#5a7215"
            emissiveIntensity={0}
            roughness={0.3}
          />
        </mesh>
      </group>
      <Wire points={ground} color="#849f44" amount={connection} />
      {!connected && (
        <Line
          points={ground}
          color="#8d9d76"
          lineWidth={1.4}
          dashed
          dashSize={0.07}
          gapSize={0.065}
        />
      )}
      <mesh position={[0.9, 0.13, 1.17]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.055, 0.083, 32]} />
        <meshBasicMaterial color={connected ? "#8ba83d" : "#a2ad90"} />
      </mesh>
      <Html position={[0.9, 0.18, 1.17]} zIndexRange={[5, 0]}>
        <div className={`ground-hint ${connected ? "complete" : ""}`}>
          <span className="hint-stem" />
          <p aria-live="polite">
            {connected
              ? "A complete path. A little light."
              : "That LED doesn’t have a path back to ground yet."}
          </p>
          <button onClick={onConnect}>
            {connected ? "Disconnect & try again" : "Connect to ground"}
            <span>{connected ? "↺" : "↗"}</span>
          </button>
        </div>
      </Html>
    </group>
  );
}
