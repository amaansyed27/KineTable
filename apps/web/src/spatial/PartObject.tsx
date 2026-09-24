import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import type { Transform } from "../projects/schema";

export function PartObject({ visualId, transform, reduced }: { visualId: string; transform: Transform; reduced: boolean }) {
  const group = useRef<Group>(null);
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { invalidate(); }, [invalidate]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const next = reduced ? 1 : MathUtils.damp(group.current.scale.x, 1, 11, delta);
    group.current.scale.setScalar(next);
    if (Math.abs(next - 1) > .002) invalidate();
  });
  return <group position={transform.position} rotation={transform.rotation} scale={transform.scale}>
    <group ref={group} scale={reduced ? 1 : .05}>
      {visualId === "led" ? <><mesh position={[0, 0, .14]}><sphereGeometry args={[.2, 20, 14]} /><meshStandardMaterial color="#d85b3e" emissive="#9e2110" emissiveIntensity={.22} /></mesh><mesh position={[0,-.26,0]}><boxGeometry args={[.08,.33,.06]} /><meshStandardMaterial color="#c7c5b9" metalness={.7} /></mesh></> : null}
      {visualId === "resistor" ? <><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.1,.1,.6,16]} /><meshStandardMaterial color="#d5b48b" /></mesh>{[-.19,-.1,.1,.19].map((x,i) => <mesh key={x} position={[x,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.102,.102,.035,16]} /><meshStandardMaterial color={["#8d3c25","#1d241f","#943f2e","#b79046"][i]} /></mesh>)}</> : null}
      {visualId === "button" ? <><mesh><boxGeometry args={[.58,.5,.12]} /><meshStandardMaterial color="#d1d0c8" /></mesh><mesh position={[0,0,.11]}><boxGeometry args={[.28,.26,.13]} /><meshStandardMaterial color="#353d38" /></mesh></> : null}
      {visualId === "buzzer" ? <><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.32,.32,.17,24]} /><meshStandardMaterial color="#323b38" /></mesh><mesh position={[0,0,.11]}><circleGeometry args={[.12,24]} /><meshStandardMaterial color="#171d1b" /></mesh></> : null}
      {visualId === "pir" ? <><mesh><boxGeometry args={[.76,.72,.08]} /><meshStandardMaterial color="#28645a" /></mesh><mesh position={[0,0,.18]}><sphereGeometry args={[.3,24,16]} /><meshStandardMaterial color="#e7e3d5" roughness={.8} /></mesh></> : null}
      {visualId === "oled" ? <><mesh><boxGeometry args={[.92,.56,.08]} /><meshStandardMaterial color="#253c42" /></mesh><mesh position={[0,0,.05]}><planeGeometry args={[.7,.39]} /><meshBasicMaterial color="#092532" /></mesh><mesh position={[-.15,.06,.055]}><planeGeometry args={[.28,.025]} /><meshBasicMaterial color="#75c9db" /></mesh></> : null}
      {visualId === "dht11" ? <><mesh><boxGeometry args={[.5,.62,.13]} /><meshStandardMaterial color="#397c9b" /></mesh>{[-.16,-.08,0,.08,.16].map(x => <mesh key={x} position={[x,.04,.07]}><boxGeometry args={[.035,.36,.01]} /><meshBasicMaterial color="#133744" /></mesh>)}</> : null}
    </group>
  </group>;
}
