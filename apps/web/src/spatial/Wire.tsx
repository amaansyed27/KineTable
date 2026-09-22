import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Vector3,
  Mesh,
  Group,
  MeshStandardMaterial,
  BufferGeometry,
  Color,
} from "three";
import type { MotionValue } from "motion/react";
import { storyFrame } from "../landing/story.mjs";
const activeColor = new Color("#b7f000");
export function Wire({
  points,
  color = "#b68155",
  progress,
  amount,
  order = 0,
  hero = false,
  display = false,
  reverse = false,
  radius = 0.018,
}: {
  points: [number, number, number][];
  color?: string;
  progress?: MotionValue<number>;
  amount?: MotionValue<number>;
  order?: number;
  hero?: boolean;
  display?: boolean;
  reverse?: boolean;
  radius?: number;
}) {
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map((p) => new Vector3(...p))),
    [points],
  );
  const base = useMemo(() => new Color(color), [color]);
  const pulse = useRef<Mesh>(null);
  const terminals = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const geometry = useRef<BufferGeometry>(null);
  const scratch = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (!progress && !amount) return;
    const f = storyFrame(progress?.get() ?? 0);
    const reveal = amount ? amount.get() : display ? 1 - f.sensor : hero ? 1 - f.wireExit : f.wiring * (1 - f.wireExit);
    geometry.current?.setDrawRange(0, Math.floor(reveal * 80) * 7 * 6);
    if (terminals.current) {
      terminals.current.children[0].visible = reveal > 0.01;
      terminals.current.children[1].visible = reveal > 0.99;
    }
    const phase = f.signal * 3 - order;
    if (material.current)
      material.current.color
        .copy(base)
        .lerp(
          activeColor,
          f.connection * (phase >= 0 && phase <= 1 ? 0.7 : 0.12),
        );
    if (pulse.current) {
      pulse.current.visible = !display && phase > 0 && phase < 1;
      curve.getPoint(
        Math.max(0, Math.min(1, reverse ? 1 - phase : phase)),
        scratch,
      );
      pulse.current.position.copy(scratch);
    }
  });
  return (
    <group>
      <mesh>
        <tubeGeometry ref={geometry} args={[curve, 80, radius, 7, false]} />
        <meshStandardMaterial ref={material} color={color} roughness={0.48} />
      </mesh>
      <group ref={terminals}>
        {[points[0], points[points.length - 1]].map((point, i) => <group key={i} position={point}>
          <mesh position={[0, 0.055, 0]}><boxGeometry args={[0.058, 0.11, 0.058]} /><meshStandardMaterial color="#30332f" roughness={0.72} /></mesh>
          <mesh position={[0, -0.025, 0]}><boxGeometry args={[0.018, 0.05, 0.018]} /><meshStandardMaterial color="#b0ada1" metalness={0.7} roughness={0.35} /></mesh>
        </group>)}
      </group>
      {progress && (
        <mesh ref={pulse} visible={false}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshBasicMaterial color="#b7f000" />
        </mesh>
      )}
    </group>
  );
}
