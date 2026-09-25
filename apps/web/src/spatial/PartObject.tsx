import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, MathUtils } from "three";
import type { Transform } from "../projects/schema";

function OledScreen({ text }: { text: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#092532"; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#9ad8e3"; ctx.font = "600 58px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 128, 470);
    return new CanvasTexture(canvas);
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0,0,.051]}><planeGeometry args={[.7,.39]} /><meshBasicMaterial map={texture} /></mesh>;
}

export function PartObject({ visualId, transform, reduced, output }: { visualId: string; transform: Transform; reduced: boolean; output?: { on?: boolean; text?: string; pressed?: boolean; motion?: boolean } }) {
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
      {visualId === "led" ? <><mesh position={[0, 0, .14]}><sphereGeometry args={[.2, 20, 14]} /><meshStandardMaterial color={output?.on ? "#f57b4d" : "#d85b3e"} emissive={output?.on ? "#f55b22" : "#9e2110"} emissiveIntensity={output?.on ? 1.8 : .22} /></mesh>{[-.11,.11].map(x => <mesh key={x} position={[x,-.26,0]}><boxGeometry args={[.035,.34,.035]} /><meshStandardMaterial color="#c7c5b9" metalness={.7} /></mesh>)}</> : null}
      {visualId === "resistor" ? <><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.1,.1,.6,16]} /><meshStandardMaterial color="#d5b48b" /></mesh>{[-.19,-.1,.1,.19].map((x,i) => <mesh key={x} position={[x,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.102,.102,.035,16]} /><meshStandardMaterial color={["#8d3c25","#1d241f","#943f2e","#b79046"][i]} /></mesh>)}{[-.39,.39].map(x => <mesh key={x} position={[x,0,0]}><boxGeometry args={[.19,.025,.025]} /><meshStandardMaterial color="#b7b9b0" metalness={.7} /></mesh>)}</> : null}
      {visualId === "button" ? <><mesh><boxGeometry args={[.58,.5,.12]} /><meshStandardMaterial color="#d1d0c8" /></mesh><mesh position={[0,0,output?.pressed ? .07 : .11]}><boxGeometry args={[.28,.26,.13]} /><meshStandardMaterial color="#353d38" /></mesh>{[-.22,.22].map(x => <mesh key={x} position={[x,-.27,.02]}><boxGeometry args={[.07,.09,.03]} /><meshStandardMaterial color="#b6b8ae" metalness={.65} /></mesh>)}</> : null}
      {visualId === "buzzer" ? <><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.32,.32,.17,24]} /><meshStandardMaterial color="#323b38" /></mesh><mesh position={[0,0,.11]}><circleGeometry args={[.12,24]} /><meshStandardMaterial color={output?.on ? "#b7ce85" : "#171d1b"} /></mesh>{[-.2,0,.2].map(x => <mesh key={x} position={[x,-.3,0]}><boxGeometry args={[.035,.15,.03]} /><meshStandardMaterial color="#bba16a" metalness={.65} /></mesh>)}</> : null}
      {visualId === "pir" ? <><mesh><boxGeometry args={[.76,.72,.08]} /><meshStandardMaterial color="#28645a" /></mesh><mesh position={[0,0,.18]}><sphereGeometry args={[.3,24,16]} /><meshStandardMaterial color={output?.motion ? "#e8e2bb" : "#e7e3d5"} roughness={.8} /></mesh>{[-.15,0,.15].map(x => <mesh key={x} position={[x,-.38,0]}><boxGeometry args={[.035,.15,.03]} /><meshStandardMaterial color="#bba16a" metalness={.65} /></mesh>)}</> : null}
      {visualId === "oled" ? <><mesh><boxGeometry args={[.92,.56,.08]} /><meshStandardMaterial color="#253c42" /></mesh><OledScreen text={output?.text ?? ""} />{[-.21,-.07,.07,.21].map(x => <mesh key={x} position={[x,-.32,.02]}><boxGeometry args={[.035,.15,.03]} /><meshStandardMaterial color="#bba16a" metalness={.65} /></mesh>)}</> : null}
      {visualId === "dht11" ? <><mesh><boxGeometry args={[.5,.62,.13]} /><meshStandardMaterial color="#397c9b" /></mesh>{[-.16,-.08,0,.08,.16].map(x => <mesh key={x} position={[x,.04,.07]}><boxGeometry args={[.035,.36,.01]} /><meshBasicMaterial color="#133744" /></mesh>)}{[-.16,0,.16].map(x => <mesh key={x} position={[x,-.33,.02]}><boxGeometry args={[.035,.13,.03]} /><meshStandardMaterial color="#bba16a" metalness={.65} /></mesh>)}</> : null}
    </group>
  </group>;
}
