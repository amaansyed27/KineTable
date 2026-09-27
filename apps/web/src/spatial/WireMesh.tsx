import { useMemo, useRef } from "react";
import { Quaternion, Vector3, Group, Mesh, TubeGeometry } from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { jumperCurve } from "./jumpers";

export function WireMesh({ from, to, color = "#60afd1", lane = 0, start, end, selected = false, highlighted = false, preview = false, dimmed=false, onSelect, anchors }: {
  from: Vector3; to: Vector3; color?: string; lane?: number; start?: Vector3; end?: Vector3; selected?: boolean; highlighted?: boolean; preview?: boolean; dimmed?:boolean; onSelect?(): void; anchors?(): [Vector3,Vector3] | null;
}) {
  const group=useRef<Group>(null), previous=useRef<[Vector3,Vector3]>([from.clone(),to.clone()]);
  const sockets = useRef<(Mesh | null)[]>([]);
  const curve = useMemo(() => jumperCurve(from, to, lane, start, end), [from, to, lane, start, end]);
  useFrame(()=>{
    if(!anchors || !group.current)return;
    const points=anchors();group.current.visible=!!points;if(!points)return;
    const [a,b]=points;if(previous.current[0].equals(a) && previous.current[1].equals(b))return;
    previous.current=[a.clone(),b.clone()];
    const next=jumperCurve(a,b,lane,start,end);
    group.current.children.forEach(child=>{const mesh=child as Mesh<TubeGeometry>;if (!(mesh.geometry instanceof TubeGeometry)) return; const params=mesh.geometry.parameters;mesh.geometry.dispose();mesh.geometry=new TubeGeometry(next,32,params.radius,params.radialSegments,false);});
    [a,b].forEach((point,i)=>sockets.current[i]?.position.copy(point).addScaledVector((i ? end : start)!, .045));
  });
  const handle = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onSelect?.(); };
  return <group ref={group}>
    <mesh onPointerDown={preview ? undefined : handle} raycast={preview ? () => null : undefined}><tubeGeometry args={[curve, 32, selected ? .025 : .019, 8, false]} /><meshStandardMaterial color={color} transparent opacity={preview ? .65 : dimmed ? .18 : 1} roughness={.62} /></mesh>
    {!preview && [start,end].map((direction,i)=>direction && <mesh key={i} ref={value=>{sockets.current[i]=value;}} position={(i ? to : from).clone().addScaledVector(direction,.045)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0,0,1),direction)} onPointerDown={handle}><boxGeometry args={[.075,.075,.15]} /><meshStandardMaterial color="#202628" roughness={.65} transparent opacity={dimmed ? .18 : 1} /></mesh>)}
    {(selected || highlighted) && <mesh raycast={()=>null}><tubeGeometry args={[curve,24,.045,6,false]} /><meshBasicMaterial color="#b7f000" transparent opacity={.25} depthWrite={false} /></mesh>}
    {!preview && <mesh onPointerDown={handle}><tubeGeometry args={[curve,24,.055,5,false]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </group>;
}
