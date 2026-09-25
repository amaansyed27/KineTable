import { useMemo } from "react";
import { QuadraticBezierCurve3, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";

export function WireMesh({ from, to, color = "blue", selected = false, highlighted = false, preview = false, onSelect }: {
  from: Vector3; to: Vector3; color?: "red" | "black" | "blue" | "yellow" | "green"; selected?: boolean; highlighted?: boolean; preview?: boolean; onSelect?(): void;
}) {
  const curve = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(.5);
    mid.z = Math.max(from.z, to.z) + Math.min(.24, .08 + from.distanceTo(to) * .025);
    return new QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);
  const colors = { red: "#bd6659", black: "#555b56", blue: "#6b8290", yellow: "#bea46c", green: "#6a8972" };
  const handle = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onSelect?.(); };
  return <group>
    <mesh onPointerDown={preview ? undefined : handle} raycast={preview ? () => null : undefined}><tubeGeometry args={[curve, 24, selected ? .025 : .015, 6, false]} /><meshStandardMaterial color={selected || highlighted ? "#9fbf76" : colors[color]} transparent opacity={preview ? .65 : 1} roughness={.8} /></mesh>
    {!preview && <mesh onPointerDown={handle}><tubeGeometry args={[curve,24,.055,5,false]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}
