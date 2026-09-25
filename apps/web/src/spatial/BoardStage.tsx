import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import { Group, MeshBasicMaterial, MathUtils } from "three";
import { boards, getBoard, type BoardId, type BoardDefinition } from "../hardware/boards";
import { BoardModel } from "./Models";
import { UnoModel } from "./UnoModel";
import { makeShadow } from "./SoftShadow";
import type { Transform } from "../projects/schema";
import type { KinetableProjectV3 } from "../projects/v3";
import { getDefinition } from "../component-library/catalog";
import { PartObject } from "./PartObject";
function BoardObject({ board, x, y, selected, quiet, hovered, reduced, single, transform }: {
  board: BoardDefinition; x: number; y: number; selected: boolean; quiet: boolean; hovered: boolean; reduced: boolean; single: boolean; transform?: Transform;
}) {
  const object = useRef<Group>(null);
  const shade = useRef<MeshBasicMaterial>(null);
  const shadow = useMemo(makeShadow, []);
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { invalidate(); }, [selected, quiet, hovered, reduced, invalidate]);
  useEffect(() => () => shadow.dispose(), [shadow]);
  useFrame((_, delta) => {
    if (!object.current) return;
    const defaultScale = single ? 1.5 : selected ? 1.08 : quiet ? .88 : 1;
    const baseScale = transform?.scale ?? [defaultScale, defaultScale, defaultScale];
    const visualScale = board.visualId === "uno" ? .82 : 1;
    const targetScale = baseScale.map(value => value * visualScale);
    const targetAngle = transform?.rotation[2] ?? (hovered ? -.12 : .07);
    const targetLift = transform ? 0 : hovered || selected ? .12 : 0;
    const amount = reduced ? 1 : 1 - Math.exp(-Math.min(delta,.06) * 13);
    const o = object.current;
    o.scale.set(MathUtils.lerp(o.scale.x, targetScale[0], amount), MathUtils.lerp(o.scale.y, targetScale[1], amount), MathUtils.lerp(o.scale.z, targetScale[2], amount));
    o.rotation.z = MathUtils.lerp(o.rotation.z, targetAngle, amount);
    o.position.y = MathUtils.lerp(o.position.y, targetLift, amount);
    if (shade.current) shade.current.opacity = hovered || selected ? .85 : .55;
    if (Math.abs(o.scale.x-targetScale[0]) + Math.abs(o.scale.y-targetScale[1]) + Math.abs(o.scale.z-targetScale[2]) + Math.abs(o.rotation.z-targetAngle) + Math.abs(o.position.y-targetLift) > .001) invalidate();
  });
  return <group position={transform?.position ?? [x,y,0]}>
    <mesh position={[0,-.5,-1]} scale={single ? [4.8,2.9,1] : [3.3,1.65,1]}><planeGeometry /><meshBasicMaterial ref={shade} map={shadow} transparent depthWrite={false} opacity={.55} /></mesh>
    <group ref={object} rotation={transform?.rotation ?? [.94,-.3,.07]}>
      {board.visualId === "uno" ? <UnoModel /> : <BoardModel pico={board.visualId === "pico"} />}
    </group>
  </group>;
}
function BoardWorld({ selected, hovered, single, reduced, transform, project }: { selected?: BoardId; hovered?: BoardId | null; single: boolean; reduced: boolean; transform?: Transform; project?: KinetableProjectV3 }) {
  const { size, camera, invalidate } = useThree();
  const mobile = size.width < 560 && !single;
  const zoom = single ? project && project.components.length > 1 ? Math.min(90,size.width/8.3,size.height/5.1) : Math.min(125,size.width/3.8,size.height/3.5) : mobile ? 64 : Math.min(102,size.width/10.5,size.height/3.3);
  useLayoutEffect(() => { camera.zoom = zoom; camera.updateProjectionMatrix(); invalidate(); }, [camera, zoom, invalidate]);
  const displayed = single ? boards.filter(b => b.id === selected) : boards;
  return <>
    <ambientLight intensity={1.8} /><directionalLight position={[-3,6,8]} intensity={3} /><directionalLight position={[5,-2,4]} intensity={1} />
    <Environment resolution={64} frames={1}><Lightformer position={[-3,4,5]} scale={[8,8,1]} intensity={2} color="#fffdf5" /></Environment>
    {displayed.map((board,i) => <BoardObject key={board.id} board={board}
      x={single || mobile ? 0 : (i-1)*size.width/3/zoom}
      y={single ? .15 : mobile ? ((1-i)*size.height/3 + 25)/zoom : 25/zoom}
      selected={selected === board.id} quiet={!!selected && selected !== board.id} hovered={hovered === board.id} reduced={reduced} single={single} transform={single ? transform : undefined} />)}
    {project?.components.filter(c => c.kind === "component").map(c => <PartObject key={c.id} visualId={getDefinition(c.definitionId)!.visualId} transform={project.layout.entities[c.id]} reduced={reduced} />)}
  </>;
}
class StageBoundary extends Component<{ children: ReactNode; single: boolean; selected?: BoardId }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="scene-fallback">{this.props.single ? `${getBoard(this.props.selected)?.name ?? "Your board"} is on your table.` : "3D previews are unavailable. Choose a board by its name below."}</p> : this.props.children; }
}
export default function BoardStage({ selected, hovered, single = false, transform, project }: { selected?: BoardId; hovered?: BoardId | null; single?: boolean; transform?: Transform; project?: KinetableProjectV3 }) {
  const reduced = !!useReducedMotion();
  return <StageBoundary selected={selected} single={single}><Canvas orthographic frameloop="demand" camera={{ position: [0,0,12], near: .1, far: 100, zoom: 90 }} dpr={[1,1.5]} gl={{ antialias: true, alpha: true }} aria-hidden="true"
    fallback={<p className="scene-fallback">3D previews are unavailable. Board selection still works.</p>}>
    <Suspense fallback={null}><BoardWorld selected={selected} hovered={hovered} single={single} reduced={reduced} transform={transform} project={project} /></Suspense>
  </Canvas></StageBoundary>;
}
