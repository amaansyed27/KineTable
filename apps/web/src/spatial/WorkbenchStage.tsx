import { Component, Suspense, useMemo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer, type CameraControls as CameraControlsType } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import { Group, Mesh, Plane, Raycaster, Vector2, Vector3 } from "three";
import { endpointKey, type ElectricalEndpoint } from "../projects/v3";
import type { CircuitProject } from "../projects/v4";
import type { Transform } from "../projects/schema";
import { getDefinition } from "../component-library/catalog";
import { BoardModel } from "./Models";
import { UnoModel } from "./UnoModel";
import { PartObject } from "./PartObject";
import { Breadboard } from "./Breadboard";
import { PinTargets } from "./PinTargets";
import { WireMesh } from "./WireMesh";
import { jumperColors, headerDirection } from "./jumpers";
import { endpointWorld } from "./anchors";
import { useSimulationStore } from "../state/simulationStore";
import { causalChain, xrayNets } from "../simulation/explain";

export type CameraAction = { sequence: number; type: "focus" | "reset" | "zoom-in" | "zoom-out"; entityId?: string };
type Props = { preview?: boolean; project: CircuitProject; selectedId: string | null; referencedIds?: string[]; selectedWireId: string | null; selectedEndpointKey: string | null;
  highlightedKeys: string[]; wireSource: ElectricalEndpoint | null; wiring: boolean;
  onSelect(id: string | null): void; onEndpoint(endpoint: ElectricalEndpoint): void; onWire(id: string): void;
  onMove(id: string, transform: Transform): void; cameraAction: CameraAction | null };
const identity: Transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function Entity({ id, kind, definitionId, visualId, transform, selected, referenced, hovered, highlighted, selectedEndpointKey, wiring, editable, xrayVisible, output, onSelect, onEndpoint, onHover, onMove, onPreview, onDragging, reduced }: {
  id: string; kind: "board" | "component" | "breadboard"; definitionId: string; visualId: string; transform: Transform; selected: boolean; referenced: boolean; hovered: boolean;
  highlighted: Set<string>; selectedEndpointKey: string | null; wiring: boolean; editable: boolean; xrayVisible: boolean; output?: { on?: boolean; text?: string; pressed?: boolean; motion?: boolean };
  onSelect(id: string): void; onEndpoint(endpoint: ElectricalEndpoint): void; onHover(id: string | null): void; onMove(id: string, transform: Transform): void; onPreview(id: string, transform: Transform | null): void; onDragging(value: boolean): void; reduced: boolean;
}) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const drag = useRef<{ x: number; y: number; origin: [number, number]; moved: boolean } | null>(null);
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => { if (!drag.current && group.current) group.current.position.set(...transform.position); ring.current?.position.set(transform.position[0], transform.position[1], -.12); invalidate(); }, [transform, invalidate]);
  const pointOnSurface = (event: ThreeEvent<PointerEvent>) => event.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -transform.position[2]), new Vector3());
  function down(event: ThreeEvent<PointerEvent>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (wiring) return;
    onSelect(id);
    if (!editable) return;
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
    onPreview(id, { ...transform, position: [x, y, transform.position[2]] });
    invalidate();
  }
  function finish(event: ThreeEvent<PointerEvent>, commit: boolean) {
    if (!drag.current) return;
    event.stopPropagation();
    if ((event.target as HTMLElement).hasPointerCapture(event.pointerId)) (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    const current = drag.current;
    drag.current = null;
    onDragging(false);
    onPreview(id, null);
    if (commit && current.moved && group.current) onMove(id, { ...transform, position: [group.current.position.x, group.current.position.y, transform.position[2]] });
    else if (group.current) { group.current.position.set(...transform.position); ring.current?.position.set(transform.position[0], transform.position[1], -.12); }
    invalidate();
  }
  return <>
    {(selected || referenced) && <mesh ref={ring} position={[transform.position[0], transform.position[1], -.12]}><ringGeometry args={[kind === "board" ? 1.42 : kind === "breadboard" ? 1.7 : .62, kind === "board" ? 1.44 : kind === "breadboard" ? 1.72 : .64, 48]} /><meshBasicMaterial color="#a5d916" transparent opacity={selected ? .48 : .28} depthWrite={false} /></mesh>}
    <group ref={group} rotation={transform.rotation} scale={transform.scale}
      onPointerDown={down} onPointerMove={move} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
      onPointerOver={event => { event.stopPropagation(); onHover(id); document.body.style.cursor = "grab"; }}
      onPointerOut={event => { event.stopPropagation(); onHover(null); document.body.style.cursor = ""; }}>
      {!wiring && kind !== "breadboard" && <mesh position={[0, 0, kind === "board" ? .2 : .02]}><sphereGeometry args={[kind === "board" ? 1.25 : .5, 16, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
      <group>
        {kind === "board" ? <group scale={visualId === "uno" ? .82 : 1}>{visualId === "uno" ? <UnoModel /> : <BoardModel pico={visualId === "pico"} />}</group> : kind === "breadboard" ? <Breadboard id={id} highlighted={highlighted} selectedHole={selectedEndpointKey?.startsWith(`hole:${id}:`) ? selectedEndpointKey.split(":")[2] : undefined} onHole={onEndpoint} /> : <PartObject visualId={visualId} transform={identity} reduced={reduced} output={output} />}
        {kind !== "breadboard" && <PinTargets componentId={id} definitionId={definitionId} visible={selected || hovered || wiring || xrayVisible} highlightedOnly={xrayVisible && !selected && !hovered} highlighted={highlighted} onPin={onEndpoint} />}
      </group>
    </group>
  </>;
}

function World({ project, preview = false, selectedId, referencedIds = [], selectedWireId, selectedEndpointKey, highlightedKeys, wireSource, wiring, onSelect, onEndpoint, onWire, onMove, cameraAction, reduced }: Props & { reduced: boolean }) {
  const mode = useSimulationStore(s => preview ? "build" : s.mode);
  const circuit = useSimulationStore(s => preview ? null : s.circuit);
  const snapshot = useSimulationStore(s => preview ? null : s.snapshot);
  const xray = useSimulationStore(s => s.xray);
  const selectedTraceId = useSimulationStore(s => s.selectedTraceId);
  const controls = useRef<CameraControlsType>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const previewTransforms = useRef<Record<string, Transform>>({});
  const pointer = useRef<Vector3 | null>(null);
  const spatialProject = () => ({ ...projectRef.current, layout: { entities: { ...projectRef.current.layout.entities, ...previewTransforms.current } } });
  const colors = useMemo(() => jumperColors(project), [project]);
  const highlighted = new Set(highlightedKeys);
  if (mode === "explain" && circuit) {
    for (const net of xrayNets(circuit, snapshot, xray)) for (const key of net.endpoints) highlighted.add(key);
    const event = snapshot?.trace.find(e => e.id === selectedTraceId);
    if (event?.netId) highlighted.clear();
    if (event && snapshot) for (const step of causalChain(snapshot.trace, event.id)) if (step.netId) for (const endpoint of circuit.nets.find(n => n.id === step.netId)?.endpoints ?? []) highlighted.add(endpointKey(endpoint));
  }
  const { camera, gl, invalidate, size } = useThree();
  useEffect(() => {
    if (!wireSource) { pointer.current=null; invalidate(); return; }
    const ray = new Raycaster(), plane = new Plane(new Vector3(0, 0, 1), -.35);
    const move = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
      const point = ray.ray.intersectPlane(plane, new Vector3());
      if (point) {pointer.current=point;invalidate();}
    };
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [wireSource, camera, gl, invalidate]);
  const bounds = project.components.reduce((b,c) => {const t=project.layout.entities[c.id];const x=(c.kind==="breadboard" ? 1.12 : c.kind==="board" ? .65 : .55)*t.scale[0], y=(c.kind==="breadboard" ? 1.53 : c.kind==="board" ? 1.2 : .45)*(c.kind==="component" ? t.scale[1] : t.scale[2]);return {left:Math.min(b.left,t.position[0]-x),right:Math.max(b.right,t.position[0]+x),bottom:Math.min(b.bottom,t.position[1]-y),top:Math.max(b.top,t.position[1]+y)};}, {left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity});
  const centerX=(bounds.left+bounds.right)/2, centerY=(bounds.bottom+bounds.top)/2;
  const fitZoom = clamp(Math.min(size.width / (bounds.right-bounds.left+1.4), size.height / (bounds.top-bounds.bottom+1.8)), 20, 160);
  const minZoom = Math.max(20, fitZoom * .6), maxZoom = Math.min(180, fitZoom * 1.5);
  const fitted = useRef("");
  const fitKey = `${project.id}:${project.components.length}:${size.width}:${size.height}`;
  useLayoutEffect(() => { if(fitted.current===fitKey)return; fitted.current=fitKey; camera.zoom = fitZoom; camera.position.set(centerX,centerY,12); camera.lookAt(centerX,centerY,0); camera.updateProjectionMatrix(); void controls.current?.setLookAt(centerX,centerY,12,centerX,centerY,0,false); void controls.current?.zoomTo(fitZoom, false); invalidate(); }, [camera, fitZoom, centerX,centerY,invalidate,fitKey]);
  useEffect(() => {
    if (!cameraAction || !controls.current) return;
    const target = cameraAction.entityId && projectRef.current.layout.entities[cameraAction.entityId]?.position;
    if (cameraAction.type === "focus" && target) void controls.current.setLookAt(target[0], target[1], 12, target[0], target[1], 0, !reduced);
    if (cameraAction.type === "reset") { void controls.current.setLookAt(centerX, centerY, 12, centerX, centerY, 0, !reduced); void controls.current.zoomTo(fitZoom, !reduced); }
    if (cameraAction.type === "zoom-in" || cameraAction.type === "zoom-out") void controls.current.zoomTo(clamp(camera.zoom * (cameraAction.type === "zoom-in" ? 1.25 : .8), minZoom, maxZoom), !reduced);
    invalidate();
  }, [cameraAction, camera, reduced, invalidate, fitZoom, minZoom, maxZoom,centerX,centerY]);
  return <>
    <ambientLight intensity={1.8} /><directionalLight position={[-3, 6, 8]} intensity={3} /><directionalLight position={[5, -2, 4]} intensity={1} />
    <Environment resolution={64} frames={1}><Lightformer position={[-3, 4, 5]} scale={[8, 8, 1]} intensity={2} color="#fffdf5" /></Environment>
    <CameraControls ref={controls} enabled={!preview && !dragging && !wireSource} minZoom={minZoom} maxZoom={maxZoom} minDistance={5} maxDistance={22} minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} minPolarAngle={.45} maxPolarAngle={2.6} />
    <mesh position={[0, 0, -1]} onPointerDown={() => { if (!wiring) onSelect(null); }}><planeGeometry args={[100, 100]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    {project.wires.map((wire, index) => <WireMesh key={wire.id} from={endpointWorld(project, wire.from)} to={endpointWorld(project, wire.to)} anchors={()=>[endpointWorld(spatialProject(),wire.from),endpointWorld(spatialProject(),wire.to)]} dimmed={mode==="explain" && !highlighted.has(endpointKey(wire.from))} color={colors.get(wire.id)} lane={index} start={headerDirection(project,wire.from)} end={headerDirection(project,wire.to)} selected={selectedWireId === wire.id} highlighted={highlighted.has(endpointKey(wire.from))} onSelect={() => onWire(wire.id)} />)}
    {wireSource && <WireMesh from={endpointWorld(project,wireSource)} to={endpointWorld(project,wireSource)} anchors={()=>pointer.current ? [endpointWorld(spatialProject(),wireSource),pointer.current] : null} preview />}
    {project.components.map(component => {
      const definition = getDefinition(component.definitionId)!;
      return <Entity key={component.id} id={component.id} kind={component.kind} definitionId={component.definitionId} visualId={definition.visualId} transform={project.layout.entities[component.id]}
        selected={selectedId === component.id} referenced={referencedIds.includes(component.id)} hovered={!preview && hovered === component.id} highlighted={highlighted} selectedEndpointKey={selectedEndpointKey} wiring={wiring} editable={!preview && mode === "build"} xrayVisible={mode === "explain"} output={snapshot?.outputs[component.id]}
        onSelect={id => { onSelect(id); if (mode === "simulate" && definition.electricalModel === "momentary-switch") useSimulationStore.getState().button(id, !snapshot?.outputs[id]?.pressed); }} onEndpoint={onEndpoint} onHover={setHovered} onMove={onMove} onPreview={(id, transform) => { if(transform)previewTransforms.current[id]=transform;else delete previewTransforms.current[id]; invalidate(); }} onDragging={setDragging} reduced={reduced} />;
    })}
  </>;
}

class WorkbenchBoundary extends Component<{ children: ReactNode; project: CircuitProject }, { failed: boolean }> {
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
