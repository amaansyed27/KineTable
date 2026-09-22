import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useTransform, type MotionValue } from "motion/react";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  DataTexture,
  RGBAFormat,
  Vector3,
  DirectionalLight,
  Material,
} from "three";
import { BoardModel, BreadboardModel, OLED, PIR, Buzzer, OtherPart, Slab } from "./Models";
import { Wire } from "./Wire";
import { storyFrame, easeRange } from "../landing/story.mjs";
const boardWire: [number, number, number][] = [
  [-1.37, 0.28, -0.57], [-1.37, 0.49, -0.57], [-0.95, 0.58, -0.75],
  [-0.35, 0.5, -0.87], [0.02, 0.32, -0.87], [0.02, 0.14, -0.87],
];
const groundWire: [number, number, number][] = [
  [-1.37, 0.28, 0.68], [-1.37, 0.46, 0.68], [-1.1, 0.4, 1.48],
  [-0.64, 0.3, 1.48], [-0.54, 0.28, 1.06], [-0.54, 0.14, 1.06],
];
const sensorWire: [number, number, number][] = [
  [0.94, 0.14, -0.73], [0.94, 0.32, -0.73], [1.25, 0.43, -0.93],
  [1.75, 0.42, -0.75], [2.03, 0.34, -0.3], [2.03, 0.19, -0.3],
];
const buzzerWire: [number, number, number][] = [
  [0.94, 0.14, 1.06], [0.94, 0.31, 1.06], [1.15, 0.32, 1.65],
  [1.65, 0.3, 1.66], [2.05, 0.28, 1.32], [2.05, 0.13, 1.32],
];
// A shared procedural soft shadow avoids four extra render passes per animation frame.
export function makeShadow() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r =
        ((x - size / 2) / (size / 2)) ** 2 + ((y - size / 2) / (size / 2)) ** 2;
      const i = (y * size + x) * 4;
      data[i] = 45;
      data[i + 1] = 48;
      data[i + 2] = 36;
      data[i + 3] = Math.round(
        Math.max(0, Math.exp(-r * 5) - Math.exp(-5)) * 100,
      );
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}
export function SoftShadow({
  texture,
  scale = [2, 3],
  height = -0.32,
}: {
  texture: DataTexture;
  scale?: [number, number];
  height?: number;
}) {
  return (
    <mesh
      position={[0, height, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[...scale, 1]}
    >
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
function SpatialLogic({ progress }: { progress: MotionValue<number> }) {
  const sensor = useRef<HTMLDivElement>(null);
  const buzzer = useRef<HTMLDivElement>(null);
  const path = useRef<Mesh>(null);
  useFrame(() => {
    const frame = storyFrame(progress.get());
    const opacity = frame.logic * (1 - frame.wireExit);
    if (sensor.current) sensor.current.style.opacity = String(opacity);
    if (buzzer.current) buzzer.current.style.opacity = String(opacity);
    if (path.current)
      (path.current.material as MeshBasicMaterial).opacity = opacity * 0.55;
  });
  const points: [number, number, number][] = [
    [2.2, 1.12, -0.9],
    [3.1, 1.2, -0.25],
    [3.15, 1.05, 0.7],
    [2.35, 0.95, 1.1],
  ];

  return (
    <group>
      <Html position={[2.2, 1.2, -0.9]} center zIndexRange={[4, 0]}>
        <div ref={sensor} className="spatial-label" style={{ opacity: 0 }}>
          <span>MOTION</span>
          <i />
        </div>
      </Html>
      <Html position={[2.35, 0.95, 1.1]} center zIndexRange={[4, 0]}>
        <div ref={buzzer} className="spatial-label" style={{ opacity: 0 }}>
          <span>BUZZER</span>
          <i />
        </div>
      </Html>
      <LogicPath points={points} meshRef={path} />
    </group>
  );
}
import { CatmullRomCurve3 } from "three";
import type { RefObject } from "react";
function LogicPath({
  points,
  meshRef,
}: {
  points: [number, number, number][];
  meshRef: RefObject<Mesh | null>;
}) {
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map((p) => new Vector3(...p))),
    [points],
  );
  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curve, 30, 0.008, 5, false]} />
      <meshBasicMaterial color="#879476" transparent opacity={0} />
    </mesh>
  );
}
export function StoryWorld({
  progress,
  reduced,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const root = useRef<Group>(null),
    board = useRef<Group>(null),
    breadboard = useRef<Group>(null),
    oled = useRef<Group>(null),
    sensor = useRef<Group>(null),
    buzzer = useRef<Group>(null),
    tray = useRef<Group>(null),
    tableParts = useRef<Group>(null);
  const sensorRing = useRef<Mesh>(null),
    boardLight = useRef<Mesh>(null),
    fill = useRef<DirectionalLight>(null);
  const shadow = useMemo(makeShadow, []);
  const trayMaterials = useRef<Material[]>([]);
  useEffect(() => {
    const materials = new Set<Material>();
    tray.current?.traverse(object => {
      if (object instanceof Mesh) {
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          material.transparent = true;
          materials.add(material);
        }
      }
    });
    trayMaterials.current = [...materials];
  }, []);
  const wireAmount = useTransform(progress, p => 1 - storyFrame(p).wireExit);
  const target = useMemo(() => new Vector3(), []);
  const invalidate = useThree((s) => s.invalidate);
  // Demand rendering still needs one frame when a reduced-motion visitor scrolls.
  useEffect(() => progress.on("change", invalidate), [progress, invalidate]);
  useFrame(({ camera, pointer, clock, size }) => {
    const p = Math.min(1, progress.get() / 0.82);
    const f = storyFrame(progress.get());
    const t = f.table;
    const packed = easeRange(t, 0, 0.45);
    const unpacked = easeRange(t, 0.4, 1);
    const narrow = size.width <= 1100;
    camera.position.set(
      6 - f.arrival * 0.8 - f.close * 0.45,
      8.5 - f.close * 0.5,
      10 + f.arrival * 0.5,
    );
    target.set(0.1 * f.arrival, 0, 0);
    camera.lookAt(target);
    const originalHeight = narrow ? size.height * (size.width <= 600 ? 0.53 : 0.56) - 35 : size.height * 0.57 - 18;
    const zoom = (1.12 + f.arrival * (narrow ? 0.28 : 0.6) + f.close * 0.12) *
      Math.min(1, size.width / 480) *
      (1 + f.arrival * (narrow ? Math.min(0.4, Math.max(0, size.width / originalHeight - 1.7) * 0.4) : 0));
    camera.zoom = (zoom * (1 - t) + (narrow ? 1.12 : 1.5) * Math.min(1, size.width / 480) * t) * originalHeight / size.height;
    // Keep the canvas fixed: camera framing owns all spatial translation.
    const centerY = narrow ? 0.72 - f.arrival * 0.10 + t * 0.025 : 0.705 - f.arrival * 0.14;
    camera.setViewOffset(size.width, size.height, -size.width * (narrow ? 0 : 0.12 * f.arrival), -size.height * (centerY - 0.5), size.width, size.height);
    camera.updateProjectionMatrix();
    if (root.current) {
      root.current.rotation.y = reduced
        ? 0
        : pointer.x * 0.035 * (1 - f.arrival);
      root.current.position.y = reduced
        ? 0
        : Math.sin(clock.elapsedTime * 0.65) * 0.025 * (1 - f.arrival);
    }
    if (tray.current) {
      tray.current.scale.setScalar(1);
      tray.current.visible = t > 0.001;
      tray.current.position.y = -(1 - t) * 0.35;
      for (const material of trayMaterials.current) material.opacity = easeRange(t, 0, 0.4);
      if (tableParts.current) tableParts.current.scale.setScalar(unpacked);
    }
    if (board.current) {
      board.current.rotation.y = 0.06 - f.assembly * 0.1;
      board.current.position.set(-1.9 + t * 0.35, 0.23 * (1 - t), 0.05 - t * 0.7);
    }
    if (breadboard.current) {
      breadboard.current.position.y = 0.08 * Math.sin(f.assembly * Math.PI) - t * 0.8;
      breadboard.current.scale.setScalar(1 - packed);
      breadboard.current.position.z = 0.3 + t * 1.2;
      breadboard.current.rotation.y = -0.025 * Math.sin(f.assembly * Math.PI);
    }
    if (oled.current) {
      oled.current.position.set(
        (2.2 + f.sensor * 4) * (1 - t) + 1.6 * t,
        (0.15 + f.sensor * 0.4) * (1 - t),
        (-0.9 - f.sensor * 2) * (1 - t) - t,
      );
      if (t > 0) oled.current.position.set(1.6 + (1 - t) * 1.1, (1 - t) * 0.25, -1);
      oled.current.scale.setScalar(1 - f.sensor + unpacked);
    }
    if (sensor.current) {
      sensor.current.position.set(
        (5.5 - f.sensor * 3.3) * (1 - t) - 1.6 * t,
        (0.15 + (1 - f.sensor) * 0.6) * (1 - t) + Math.sin(t * Math.PI) * 0.65,
        (-2.8 + f.sensor * 1.9) * (1 - t) + 1.25 * t,
      );
      sensor.current.rotation.y = -0.12 + (1 - f.sensor) * 0.35;
      sensor.current.scale.setScalar(easeRange(p, 0.26, 0.31));
    }
    if (buzzer.current) {
      buzzer.current.position.set(
        5.7 - f.buzzer * 3.35,
        0.1 + (1 - f.buzzer) * 0.3,
        2.5 - f.buzzer * 1.4,
      );
      buzzer.current.scale.setScalar(easeRange(p, 0.32, 0.36) * (1 - packed));
      buzzer.current.rotation.z = reduced
        ? 0
        : Math.sin(f.signal * 70) * 0.04 * easeRange(f.signal, 0.7, 0.82);
    }
    const trigger =
      easeRange(p, 0.81, 0.845) * (1 - easeRange(p, 0.855, 0.885));
    if (sensorRing.current) {
      sensorRing.current.scale.setScalar(1 + trigger * 0.3);
      (sensorRing.current.material as MeshBasicMaterial).opacity =
        trigger * 0.65;
    }
    if (boardLight.current)
      (boardLight.current.material as MeshBasicMaterial).opacity = easeRange(
        f.signal,
        0.3,
        0.5,
      );
    if (fill.current) fill.current.intensity = 1 + f.arrival * 0.15;
  });
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[-3, 8, 5]} intensity={3} />
      <directionalLight ref={fill} position={[5, 3, -3]} intensity={1} />
      <group ref={root}>
        <group ref={tray} scale={0}>
          <Slab size={[5.7, 0.18, 4.7]} position={[0, -0.3, 0]} color="#d6d2c7" />
          {[-1, 1].map(side => <group key={side}>
            <Slab size={[5.7, 0.16, 0.1]} position={[0, -0.18, side * 2.3]} color="#d6d2c7" />
            <Slab size={[0.1, 0.16, 4.7]} position={[side * 2.8, -0.18, 0]} color="#d6d2c7" />
          </group>)}
          <group ref={tableParts}>
          <group position={[-0.1, 0, -0.8]} rotation={[0, 0.12, 0]}><BoardModel pico /></group>
          <group position={[0.1, 0, 1]}><OtherPart /></group>
          <group position={[1.7, 0, 0.9]}><OtherPart relay /></group>
          </group>
          <SoftShadow texture={shadow} scale={[7, 6]} height={-0.45} />
        </group>
        <group
          ref={board}
          position={[-1.9, 0.23, 0.05]}
          rotation={[0, 0.06, 0]}
        >
          <BoardModel />
          <SoftShadow texture={shadow} />
          <mesh ref={boardLight} position={[0.28, 0.16, 0.76]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshBasicMaterial color="#b7f000" transparent opacity={0} />
          </mesh>
        </group>
        <group ref={breadboard} position={[0.3, 0, 0.3]}>
          <BreadboardModel />
          <SoftShadow texture={shadow} scale={[3.3, 4.2]} />
        </group>
        <group ref={oled} position={[2.2, 0.15, -0.9]} rotation={[0, -0.12, 0]}>
          <OLED />
          <SoftShadow texture={shadow} scale={[1.9, 1.9]} />
        </group>
        <group ref={sensor} scale={0}>
          <PIR />
          <SoftShadow texture={shadow} scale={[1.9, 1.9]} />
          <mesh
            ref={sensorRing}
            position={[0, 0.085, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.55, 0.57, 48]} />
            <meshBasicMaterial color="#9bb842" transparent opacity={0} />
          </mesh>
        </group>
        <group ref={buzzer} scale={0}>
          <Buzzer />
          <SoftShadow texture={shadow} scale={[1.5, 1.5]} />
        </group>
        <Wire points={boardWire} progress={progress} hero order={1} reverse />
        <Wire points={groundWire} color="#66716b" amount={wireAmount} />
        <Wire points={sensorWire} progress={progress} display color="#a1a695" />
        <Wire
          points={sensorWire}
          progress={progress}
          order={0}
          reverse
          color="#a1a695"
        />
        <Wire
          points={buzzerWire}
          progress={progress}
          order={2}
          color="#b28d64"
        />
        <SpatialLogic progress={progress} />
      </group>
    </>
  );
}
