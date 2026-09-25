import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D, Color, CanvasTexture } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { holes } from "../hardware-core/breadboard";
import { holeEndpoint, type HoleEndpoint } from "../projects/v3";
import { Slab } from "./Models";

export function Breadboard({ id, highlighted, selectedHole, onHole }: { id: string; highlighted: Set<string>; selectedHole?: string; onHole(endpoint: HoleEndpoint): void }) {
  const mesh = useRef<InstancedMesh>(null);
  const labels = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 768;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#626b61"; ctx.font = "22px Arial"; ctx.textAlign = "center";
    for (const column of [1,5,10,15,20,25,30]) ctx.fillText(String(column), 256, (1.31 - (column - 1) * .09 + 1.525) / 3.05 * 768);
    for (const [letter,x] of [["A",-.58],["E",-.16],["F",.16],["J",.58]] as const) ctx.fillText(letter, (x + 1.1) / 2.2 * 512, (1.43 + 1.525) / 3.05 * 768);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => labels.dispose(), [labels]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new Object3D();
    object.rotation.set(-Math.PI / 2, 0, 0);
    holes.forEach((hole, index) => {
      object.position.set(hole.x, .124, hole.y);
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
      mesh.current!.setColorAt(index, new Color(selectedHole === hole.id ? "#b8dd55" : highlighted.has(`hole:${id}:${hole.id}`) ? "#a1bd69" : "#4d554d"));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [id, highlighted, selectedHole]);
  function select(event: ThreeEvent<PointerEvent>) {
    if (event.instanceId === undefined) return;
    event.stopPropagation();
    onHole(holeEndpoint(id, holes[event.instanceId].id));
  }
  return <group>
    <Slab size={[2.2,.15,3.05]} color="#ddd9cc" />
    <Slab size={[1.35,.025,2.78]} position={[0,.087,0]} color="#ece9df" />
    <Slab size={[.085,.026,2.79]} position={[0,.105,0]} color="#c8c7bf" />
    {[-.78,.78].map(x => <Slab key={x} size={[.015,.003,2.55]} position={[x,.119,0]} color={x < 0 ? "#b75e55" : "#657f8d"} />)}
    <instancedMesh ref={mesh} args={[undefined,undefined,holes.length]} onPointerDown={select}>
      <circleGeometry args={[.039,10]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
    <mesh position={[0,.127,0]} rotation={[-Math.PI/2,0,0]} raycast={() => null}><planeGeometry args={[2.2,3.05]} /><meshBasicMaterial map={labels} transparent depthWrite={false} /></mesh>
  </group>;
}
