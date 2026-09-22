import { Slab, RepeatedBoxes, MountHole } from "./Models";
import { SurfaceMarkings } from "./SurfaceMarkings";
export function UnoModel() {
  const sockets: [number, number, number][] = [-1, 1].flatMap(side => Array.from({ length: side === 1 ? 14 : 12 }, (_, i) => [side * .97, .26, -.87 + i * .14] as [number, number, number]));
  return <group>
    <Slab size={[2.15, .07, 2.8]} color="#27757a" />
    <SurfaceMarkings kind="uno" size={[2.1, 2.75]} position={[0, .037, 0]} />
    {[-.97,.97].map(x => <Slab key={x} size={[.17,.22,1.94]} position={[x,.145,.04]} color="#202723" />)}
    <RepeatedBoxes positions={sockets} size={[.085,.009,.08]} color="#0c1512" />
    <Slab size={[.36,.14,1.03]} position={[.35,.13,.24]} color="#222823" />
    <RepeatedBoxes positions={[-1,1].flatMap(side => Array.from({ length: 14 },(_,i) => [.35 + side * .22,.09,-.22 + i*.074] as [number,number,number]))} size={[.1,.025,.037]} color="#b2b5a7" metalness={.7} />
    <Slab size={[.53,.4,.6]} position={[-.45,.22,1.15]} color="#b4bcb8" metalness={.85} roughness={.3} />
    <Slab size={[.38,.27,.013]} position={[-.45,.22,1.46]} color="#313d38" />
    <Slab size={[.39,.34,.58]} position={[.65,.19,1.1]} color="#252a24" />
    <mesh position={[.65,.21,1.41]}><circleGeometry args={[.11,24]} /><meshStandardMaterial color="#111711" /></mesh>
    <Slab size={[.26,.045,.31]} position={[-.43,.09,.45]} color="#2b3029" />
    <Slab size={[.21,.07,.3]} position={[-.42,.1,-.1]} color="#b8bdaf" metalness={.6} />
    <Slab size={[.23,.12,.23]} position={[-.54,.1,-1.1]} color="#b6b8aa" metalness={.4} />
    <Slab size={[.12,.06,.12]} position={[-.54,.19,-1.1]} color="#a86746" />
    <RepeatedBoxes positions={Array.from({length:8},(_,i)=>[-.5+(i%3)*.15,.08,-.65+Math.floor(i/3)*.18])} size={[.065,.07,.1]} color="#c9b393" />
    {[[-.9,.04,-1.2],[.9,.04,-1.2],[-.86,.04,1.13]].map((p,i)=><MountHole key={i} position={p as [number,number,number]} />)}
    <mesh position={[-.22,.1,.85]}><boxGeometry args={[.06,.06,.1]} /><meshStandardMaterial color="#b4c167" /></mesh>
  </group>;
}
