import { Component, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer, type CameraControls as CameraControlsType } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import { Group, Mesh, Plane, Vector3 } from "three";
import type { KinetableProjectV2 } from "../projects/v2";
import type { Transform } from "../projects/schema";
import { getDefinition } from "../component-library/catalog";
import { BoardModel } from "./Models";
import { UnoModel } from "./UnoModel";
import { PartObject } from "./PartObject";

export type CameraAction = { sequence: number; type: "focus" | "reset" | "zoom-in" | "zoom-out"; entityId?: string };
type Props = { project: KinetableProjectV2; selectedId: string | null; onSelect(id: string | null): void;
  onMove(id: string, transform: Transform): void; cameraAction: CameraAction | null };
const identity: Transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function Entity({ id, kind, visualId, transform, selected, hovered, onSelect, onHover, onMove, onDragging, reduced }: {
  id: string; kind: "board" | "component"; visualId: string; transform: Transform; selected: boolean; hovered: boolean;
  onSelect(id: string): void; onHover(id: string | null): void; onMove(id: string, transform: Transform): void; onDragging(value: boolean): void; reduced: boolean;
}) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const drag = useRef<{ x: number; y: number; origin: [number, number]; moved: boolean } | null>(null);
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { if (!drag.current && group.current) group.current.position.set(...transform.position); ring.current?.position.set(transform.position[0], transform.position[1], -.12); invalidate(); }, [transform, invalidate]);
  const pointOnSurface = (event: ThreeEvent<PointerEvent>) => event.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -transform.position[2]), new Vector3());
  function down(event: ThreeEvent<PointerEvent>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect(id);
    const point = pointOnSurface(event);
    if (!point) return;
    drag.current = { x: transform.position[0] - point.x, y: transform.position[1] - point.y, origin: [transform.position[0], transform.position[1]], moved: false };
    onDragging(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }
  function move(event: ThreeEvent<PointerEvent>) {
    if (!drag.current || !group.current) return;
    event.stopPropagation();
    const point = pointOnSurface(event);
    if (!point) return;
    const x = clamp(point.x + drag.current.x, -4.5, 4.5), y = clamp(point.y + drag.current.y, -2.8, 2.8);
    if (Math.abs(x - drag.current.origin[0]) + Math.abs(y - drag.current.origin[1]) > .015) drag.current.moved = true;
    group.current.position.set(x, y, transform.position[2]);
    ring.current?.position.set(x, y, -.12);
    invalidate();
  }
  function finish(event: ThreeEvent<PointerEvent>, commit: boolean) {
    if (!drag.current) return;
    event.stopPropagation();
    if ((event.target as HTMLElement).hasPointerCapture(event.pointerId)) (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    const current = drag.current;
    drag.current = null;
    onDragging(false);
    if (commit && current.moved && group.current) onMove(id, { ...transform, position: [group.current.position.x, group.current.position.y, transform.position[2]] });
    else if (group.current) { group.current.position.set(...transform.position); ring.current?.position.set(transform.position[0], transform.position[1], -.12); }
    invalidate();
  }
  return <>
    {selected && <mesh ref={ring} position={[transform.position[0], transform.position[1], -.12]}><ringGeometry args={[kind === "board" ? 1.42 : .62, kind === "board" ? 1.44 : .64, 48]} /><meshBasicMaterial color="#a5d916" transparent opacity={.48} depthWrite={false} /></mesh>}
    <group ref={group} position={transform.position} rotation={transform.rotation} scale={transform.scale}
      onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
      onPointerOver={event => { event.stopPropagation(); onHover(id); document.body.style.cursor = "grab"; }}
      onPointerOut={event => { event.stopPropagation(); onHover(null); document.body.style.cursor = ""; }}>
      <mesh position={[0, 0, kind === "board" ? .2 : .02]}><sphereGeometry args={[kind === "board" ? 1.25 : .5, 16, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      <group position={[0, 0, selected || hovered ? reduced ? .035 : .06 : 0]}>
        {kind === "board" ? <group scale={visualId === "uno" ? .82 : 1}>{visualId === "uno" ? <UnoModel /> : <BoardModel pico={visualId === "pico"} />}</group> : <PartObject visualId={visualId} transform={identity} reduced={reduced} />}
      </group>
    </group>
  </>;
}

function World({ project, selectedId, onSelect, onMove, cameraAction, reduced }: Props & { reduced: boolean }) {
  const controls = useRef<CameraControlsType>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const { camera, invalidate, size } = useThree();
  const assembled = project.components.length > 1;
  const fitZoom = clamp(Math.min(size.width / (assembled ? 11 : 4), size.height / (assembled ? 6.6 : 3.5)), 25, 160);
  const minZoom = Math.max(20, fitZoom * .6), maxZoom = Math.min(180, fitZoom * 1.5);
  useLayoutEffect(() => { camera.zoom = fitZoom; camera.updateProjectionMatrix(); void controls.current?.zoomTo(fitZoom, false); invalidate(); }, [camera, fitZoom, invalidate]);
  useEffect(() => {
    if (!cameraAction || !controls.current) return;
    const target = cameraAction.entityId && projectRef.current.layout.entities[cameraAction.entityId]?.position;
    if (cameraAction.type === "focus" && target) void controls.current.setLookAt(target[0], target[1], 12, target[0], target[1], 0, !reduced);
    if (cameraAction.type === "reset") { void controls.current.setLookAt(0, 0, 12, 0, 0, 0, !reduced); void controls.current.zoomTo(fitZoom, !reduced); }
    if (cameraAction.type === "zoom-in" || cameraAction.type === "zoom-out") void controls.current.zoomTo(clamp(camera.zoom * (cameraAction.type === "zoom-in" ? 1.25 : .8), minZoom, maxZoom), !reduced);
    invalidate();
  }, [cameraAction, camera, reduced, invalidate, fitZoom, minZoom, maxZoom]);
  return <>
    <ambientLight intensity={1.8} /><directionalLight position={[-3, 6, 8]} intensity={3} /><directionalLight position={[5, -2, 4]} intensity={1} />
    <Environment resolution={64} frames={1}><Lightformer position={[-3, 4, 5]} scale={[8, 8, 1]} intensity={2} color="#fffdf5" /></Environment>
    <CameraControls ref={controls} enabled={!dragging} minZoom={minZoom} maxZoom={maxZoom} minDistance={5} maxDistance={22} minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} minPolarAngle={.45} maxPolarAngle={2.6} />
    <mesh position={[0, 0, -1]} onPointerDown={() => onSelect(null)}><planeGeometry args={[100, 100]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    {project.components.map(component => {
      const definition = getDefinition(component.definitionId)!;
      return <Entity key={component.id} id={component.id} kind={component.kind} visualId={definition.visualId} transform={project.layout.entities[component.id]}
        selected={selectedId === component.id} hovered={hovered === component.id} onSelect={onSelect} onHover={setHovered} onMove={onMove} onDragging={setDragging} reduced={reduced} />;
    })}
  </>;
}

class WorkbenchBoundary extends Component<{ children: ReactNode; project: KinetableProjectV2 }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="workbench-fallback" role="status"><strong>3D editing is unavailable.</strong><span>{this.props.project.name} is safe on this device. Your parts remain listed below.</span></div> : this.props.children; }
}
export default function WorkbenchStage(props: Props) {
  const reduced = !!useReducedMotion();
  return <WorkbenchBoundary project={props.project}><Canvas orthographic frameloop="demand" camera={{ position: [0, 0, 12], near: .1, far: 100, zoom: 85 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} aria-label="Interactive 3D workbench"
    fallback={<div className="workbench-fallback" role="status">3D editing is unavailable. Your project is safe; use the part list below.</div>}>
    <Suspense fallback={null}><World {...props} reduced={reduced} /></Suspense>
  </Canvas></WorkbenchBoundary>;
}
