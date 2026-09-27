import { useMemo, useRef } from "react";
import { CubicBezierCurve3, Vector3, Group, Mesh, TubeGeometry } from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";

export function WireMesh({ from, to, color = "blue", selected = false, highlighted = false, preview = false, dimmed=false, onSelect, anchors }: {
  from: Vector3; to: Vector3; color?: "red" | "black" | "blue" | "yellow" | "green"; selected?: boolean; highlighted?: boolean; preview?: boolean; dimmed?:boolean; onSelect?(): void; anchors?(): [Vector3,Vector3] | null;
}) {
  const group=useRef<Group>(null), previous=useRef<[Vector3,Vector3]>([from.clone(),to.clone()]);
  const curve = useMemo(() => {
    const height = Math.max(from.z, to.z) + Math.min(.65, .18 + from.distanceTo(to) * .07);
    const a=from.clone().lerp(to,.25), b=from.clone().lerp(to,.75);
    a.z=height;b.z=height;
    return new CubicBezierCurve3(from, a, b, to);
  }, [from, to]);
  useFrame(()=>{
    if(!anchors || !group.current)return;
    const points=anchors();group.current.visible=!!points;if(!points)return;
    const [a,b]=points;if(previous.current[0].equals(a) && previous.current[1].equals(b))return;
    previous.current=[a.clone(),b.clone()];
    const height=Math.max(a.z,b.z)+Math.min(.65,.18+a.distanceTo(b)*.07), c=a.clone().lerp(b,.25),d=a.clone().lerp(b,.75);c.z=height;d.z=height;
    const next=new CubicBezierCurve3(a,c,d,b);
    group.current.children.forEach(child=>{const mesh=child as Mesh<TubeGeometry>;const params=mesh.geometry.parameters;mesh.geometry.dispose();mesh.geometry=new TubeGeometry(next,24,params.radius,params.radialSegments,false);});
  });
  const colors = { red: "#af493a", black: "#383d39", blue: "#487688", yellow: "#b39545", green: "#497852" };
  const handle = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onSelect?.(); };
  return <group ref={group}>
    <mesh onPointerDown={preview ? undefined : handle} raycast={preview ? () => null : undefined}><tubeGeometry args={[curve, 24, selected ? .025 : .015, 6, false]} /><meshStandardMaterial color={colors[color]} transparent opacity={preview ? .65 : dimmed ? .18 : 1} roughness={.8} /></mesh>
    {(selected || highlighted) && <mesh raycast={()=>null}><tubeGeometry args={[curve,24,.045,6,false]} /><meshBasicMaterial color="#b7f000" transparent opacity={.25} depthWrite={false} /></mesh>}
    {!preview && <mesh onPointerDown={handle}><tubeGeometry args={[curve,24,.055,5,false]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}
