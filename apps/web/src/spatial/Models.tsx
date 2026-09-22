import { RoundedBox } from "@react-three/drei";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Group, InstancedMesh, Object3D } from "three";
import { useFrame } from "@react-three/fiber";
import { SurfaceMarkings } from "./SurfaceMarkings";
export function Slab({
  size,
  position = [0, 0, 0],
  color = "#244a40",
  metalness = 0,
  roughness = 0.65,
  children,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  color?: string;
  metalness?: number;
  roughness?: number;
  children?: ReactNode;
}) {
  return (
    <group position={position}>
      <RoundedBox
        args={size}
        radius={Math.min(0.035, ...size.map((v) => v / 3))}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
        />
      </RoundedBox>
      {children}
    </group>
  );
}
function RepeatedBoxes({
  positions,
  size,
  color,
  metalness = 0,
}: {
  positions: [number, number, number][];
  size: [number, number, number];
  color: string;
  metalness?: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new Object3D();
    positions.forEach((p, i) => {
      m.position.set(...p);
      m.updateMatrix();
      mesh.current!.setMatrixAt(i, m.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, positions.length]}
      castShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={metalness ? 0.36 : 0.7}
      />
    </instancedMesh>
  );
}
function MountHole({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.032, 0.055, 20]} />
        <meshStandardMaterial
          color="#b8a372"
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0, -0.002]}>
        <circleGeometry args={[0.032, 20]} />
        <meshBasicMaterial color="#363f32" />
      </mesh>
    </group>
  );
}
export function BoardModel({ pico = false }: { pico?: boolean }) {
  const pins: [number, number, number][] = [-1, 1].flatMap((side) =>
    Array.from(
      { length: 15 },
      (_, i) =>
        [side * (pico ? 0.36 : 0.53), 0, -0.88 + i * 0.125] as [
          number,
          number,
          number,
        ],
    ),
  );
  return (
    <group>
      <Slab
        size={[pico ? 0.78 : 1.12, 0.065, 2.15]}
        color={pico ? "#3d755c" : "#1d3f32"}
        roughness={0.8}
      />
      <SurfaceMarkings
        kind={pico ? "pico" : "esp32"}
        size={[pico ? 0.76 : 1.1, 2.1]}
        position={[0, 0.034, 0]}
      />
      <RepeatedBoxes
        positions={pins}
        size={[0.095, 0.13, 0.095]}
        color="#202620"
      />
      <RepeatedBoxes
        positions={pins.map(([x, , z]) => [x, -0.12, z])}
        size={[0.026, 0.27, 0.026]}
        color="#c5a363"
        metalness={0.8}
      />
      <RepeatedBoxes
        positions={pins.map(([x, , z]) => [x, 0.075, z])}
        size={[0.032, 0.028, 0.032]}
        color="#bc9e60"
        metalness={0.7}
      />
      {pico ? (
        <>
          <Slab
            size={[0.4, 0.065, 0.4]}
            position={[0, 0.065, 0.06]}
            color="#242925"
            roughness={0.55}
          />
          <RepeatedBoxes
            positions={[-1, 1].flatMap((side) =>
              Array.from(
                { length: 8 },
                (_, i) =>
                  [side * 0.215, 0.06, -0.11 + i * 0.045] as [
                    number,
                    number,
                    number,
                  ],
              ),
            )}
            size={[0.07, 0.018, 0.025]}
            color="#a1a99b"
            metalness={0.6}
          />
          <Slab
            size={[0.16, 0.07, 0.23]}
            position={[0, 0.07, -0.69]}
            color="#d1d3c7"
            metalness={0.3}
          />
        </>
      ) : (
        <>
          <Slab
            size={[0.76, 0.1, 1.05]}
            position={[0, 0.09, -0.1]}
            color="#a9b3ac"
            metalness={0.75}
            roughness={0.4}
          />
          <SurfaceMarkings
            kind="shield"
            size={[0.67, 0.91]}
            position={[0, 0.142, -0.1]}
          />
          <Slab
            size={[0.76, 0.035, 0.43]}
            position={[0, 0.05, -0.84]}
            color="#202c25"
          />
          <RepeatedBoxes
            positions={Array.from({ length: 6 }, (_, i) => [
              0,
              0.07,
              -1 + i * 0.061,
            ])}
            size={[0.53, 0.006, 0.021]}
            color="#c1a268"
            metalness={0.7}
          />
          <Slab
            size={[0.025, 0.006, 0.36]}
            position={[0.255, 0.072, -0.84]}
            color="#c1a268"
            metalness={0.7}
          />
        </>
      )}
      <Slab
        size={[0.43, 0.17, 0.29]}
        position={[0, 0.09, 1.03]}
        color="#aab1aa"
        metalness={0.85}
        roughness={0.3}
      />
      <Slab
        size={[0.32, 0.095, 0.03]}
        position={[0, 0.095, 1.18]}
        color="#252c27"
      />
      <RepeatedBoxes
        positions={Array.from({ length: 5 }, (_, i) => [
          -0.09 + i * 0.045,
          0.065,
          1.2,
        ])}
        size={[0.018, 0.015, 0.023]}
        color="#b79d61"
        metalness={0.8}
      />
      {[-0.33, 0.33].map((x) => (
        <group key={x} position={[x, 0.07, 0.76]}>
          <Slab size={[0.17, 0.09, 0.2]} color="#a3a99e" metalness={0.4} />
          <Slab
            size={[0.1, 0.065, 0.12]}
            position={[0, 0.06, 0]}
            color="#272e26"
          />
        </group>
      ))}
      <Slab
        size={[0.24, 0.065, 0.2]}
        position={[0, 0.068, 0.6]}
        color="#2b302a"
      />
      <RepeatedBoxes
        positions={[-0.34, 0.34].flatMap((x) =>
          [-0.52, -0.32, 0.32, 0.45].map(
            (z) => [x, 0.057, z] as [number, number, number],
          ),
        )}
        size={[0.07, 0.045, 0.1]}
        color="#b4ae8f"
      />
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((end) => (
          <MountHole
            key={`${side}-${end}`}
            position={[side * (pico ? 0.28 : 0.44), 0.037, end * 0.985]}
          />
        )),
      )}
    </group>
  );
}
function BreadboardHoles() {
  const holes = useRef<InstancedMesh>(null);
  const rims = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const t = new Object3D();
    t.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    let i = 0;
    for (const side of [-1, 1])
      for (let r = 0; r < 20; r++)
        for (const x of [0.16, 0.28, 0.4, 0.52, 0.64, 0.84, 0.96]) {
          t.position.set(side * x, 0.112, -1.31 + r * 0.138);
          t.updateMatrix();
          holes.current!.setMatrixAt(i, t.matrix);
          t.position.y = 0.114;
          t.updateMatrix();
          rims.current!.setMatrixAt(i++, t.matrix);
        }
    holes.current!.instanceMatrix.needsUpdate = true;
    rims.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return <>
    <instancedMesh ref={holes} args={[undefined, undefined, 280]}>
      <circleGeometry args={[0.029, 4]} />
      <meshBasicMaterial color="#44463f" />
    </instancedMesh>
    <instancedMesh ref={rims} args={[undefined, undefined, 280]}>
      <ringGeometry args={[0.029, 0.042, 4]} />
      <meshStandardMaterial color="#c5c2b8" roughness={0.9} />
    </instancedMesh>
  </>;
}
export function BreadboardModel() {
  return <group>
    <Slab size={[2.2, 0.12, 3.05]} position={[0, -0.02, 0]} color="#d1cfc5" />
    {/* Separate molded banks leave a real recessed center channel. */}
    {[-1, 1].map(side => <group key={side}>
      <Slab size={[0.66, 0.09, 3.02]} position={[side * 0.405, 0.065, 0]} color="#e3dfd2" roughness={0.88} />
      <Slab size={[0.33, 0.09, 3.02]} position={[side * 0.92, 0.065, 0]} color="#e3dfd2" roughness={0.88} />
      <Slab size={[0.07, 0.055, 0.22]} position={[side * 1.115, -0.01, 0.55]} color="#d1cfc5" />
      <Slab size={[0.009, 0.003, 2.68]} position={[side * 1.04, 0.112, 0]} color="#9a635b" />
      <Slab size={[0.009, 0.003, 2.68]} position={[side * 0.775, 0.112, 0]} color="#647d86" />
    </group>)}
    <BreadboardHoles />
    <SurfaceMarkings kind="breadboard" size={[2.2, 3]} position={[0, 0.117, 0]} />
  </group>;
}
export function OLED() {
  return (
    <group>
      <Slab size={[1.2, 0.055, 1.12]} color="#264a59" roughness={0.8} />
      <Slab
        size={[1.04, 0.075, 0.83]}
        position={[0, 0.062, -0.05]}
        color="#252b29"
        roughness={0.4}
      />
      <Slab
        size={[0.91, 0.015, 0.65]}
        position={[0, 0.108, -0.04]}
        color="#0f2327"
        roughness={0.25}
      />
      <SurfaceMarkings
        kind="oled"
        size={[0.85, 0.6]}
        position={[0, 0.117, -0.04]}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <MountHole key={`${x}-${z}`} position={[x * 0.52, 0.029, z * 0.47]} />
        )),
      )}
      <Slab
        size={[0.53, 0.04, 0.16]}
        position={[0, 0.038, 0.43]}
        color="#b6883f"
        roughness={0.7}
      />
      <RepeatedBoxes
        positions={Array.from({ length: 4 }, (_, i) => [
          -0.21 + i * 0.14,
          0.04,
          0.59,
        ])}
        size={[0.035, 0.065, 0.29]}
        color="#b99c62"
        metalness={0.75}
      />
    </group>
  );
}
export function PIR() {
  return (
    <group>
      <Slab size={[1.1, 0.055, 1.08]} color="#2c5942" roughness={0.8} />
      <mesh position={[0, 0.105, -0.08]}>
        <cylinderGeometry args={[0.48, 0.48, 0.13, 64]} />
        <meshStandardMaterial color="#e4e2d8" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.16, -0.08]} castShadow>
        <sphereGeometry
          args={[0.455, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshStandardMaterial color="#efede3" roughness={0.62} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = ((i + 1) * Math.PI) / 17;
        return (
          <mesh
            key={i}
            position={[0, 0.16 + Math.cos(a) * 0.456, -0.08]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[Math.sin(a) * 0.456, 0.004, 4, 64]} />
            <meshStandardMaterial color="#d9d9cd" roughness={0.65} />
          </mesh>
        );
      })}
      {[-0.3, 0.3].map((x) => (
        <group key={x} position={[x, 0.09, 0.46]}>
          <Slab size={[0.21, 0.16, 0.19]} color="#b8823f" />
          <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 20]} />
            <meshStandardMaterial color="#d4b06c" roughness={0.6} />
          </mesh>
          <Slab
            size={[0.08, 0.005, 0.017]}
            position={[0, 0.093, 0]}
            color="#795a30"
          />
        </group>
      ))}
      <RepeatedBoxes
        positions={[-0.15, 0, 0.15].map((x) => [x, -0.005, 0.62])}
        size={[0.035, 0.04, 0.27]}
        color="#bfa369"
        metalness={0.8}
      />
    </group>
  );
}
export function Buzzer({
  active = false,
  reduced = false,
}: {
  active?: boolean;
  reduced?: boolean;
}) {
  const body = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (body.current)
      body.current.rotation.z =
        active && !reduced && clock.elapsedTime % 4.5 > 3.3
          ? Math.sin(clock.elapsedTime * 70) * 0.025
          : 0;
  });
  return (
    <group ref={body}>
      <mesh position={[0, 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.4, 64]} />
        <meshStandardMaterial color="#272d28" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.395, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.075, 0.33, 48]} />
        <meshStandardMaterial color="#303830" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.389, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.078, 32]} />
        <meshBasicMaterial color={active ? "#b7f000" : "#101b12"} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.379, 0.012, 6, 48]} />
        <meshStandardMaterial color="#485044" roughness={0.8} />
      </mesh>
      <Slab
        size={[0.09, 0.005, 0.014]}
        position={[-0.19, 0.398, 0]}
        color="#8b9486"
      />
      <Slab
        size={[0.014, 0.005, 0.09]}
        position={[-0.19, 0.398, 0]}
        color="#8b9486"
      />
    </group>
  );
}
export function OtherPart({ relay = false }: { relay?: boolean }) {
  return (
    <group>
      <Slab size={[0.9, 0.055, 1.12]} color="#2b5541" />
      <Slab
        size={[0.65, 0.5, 0.75]}
        position={[0, 0.28, 0]}
        color={relay ? "#607f83" : "#658c9e"}
        roughness={0.7}
      />
      {!relay ? (
        Array.from({ length: 6 }, (_, i) => (
          <Slab
            key={i}
            size={[0.47, 0.014, 0.042]}
            position={[0, 0.538, -0.26 + i * 0.105]}
            color="#2c535e"
          />
        ))
      ) : (
        <SurfaceMarkings
          kind="relay"
          size={[0.55, 0.65]}
          position={[0, 0.532, 0]}
        />
      )}
      <RepeatedBoxes
        positions={[-0.24, 0, 0.24].map((x) => [x, 0, -0.63])}
        size={[0.033, 0.05, 0.3]}
        color="#b69b60"
        metalness={0.7}
      />
      {relay &&
        [-0.24, 0, 0.24].map((x) => (
          <Slab
            key={x}
            size={[0.21, 0.2, 0.25]}
            position={[x, 0.15, 0.48]}
            color="#8f9b78"
          >
            <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.059, 20]} />
              <meshStandardMaterial
                color="#b1b8aa"
                metalness={0.75}
                roughness={0.4}
              />
            </mesh>
            <Slab
              size={[0.075, 0.004, 0.014]}
              position={[0, 0.11, 0]}
              color="#53604b"
            />
          </Slab>
        ))}
    </group>
  );
}
