import { getDefinition } from "../component-library/catalog";
import { pinEndpoint, type PinEndpoint } from "../projects/v3";
import { pinAnchors } from "./anchors";
import type { ThreeEvent } from "@react-three/fiber";

export function PinTargets({ componentId, definitionId, visible, highlighted, highlightedOnly = false, onPin }: {
  componentId: string; definitionId: string; visible: boolean; highlighted: Set<string>; highlightedOnly?: boolean; onPin(endpoint: PinEndpoint): void;
}) {
  const definition = getDefinition(definitionId)!;
  if (!visible) return null;
  return <group>{definition.pins.map(pin => {
    const anchor = pinAnchors[definitionId]?.[pin.id];
    if (!anchor) throw new Error(`Missing anchor ${definitionId}:${pin.id}`);
    const lit = highlighted.has(`pin:${componentId}:${pin.id}`);
    if (highlightedOnly && !lit) return null;
    const pick = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); onPin(pinEndpoint(componentId, pin.id)); };
    return <group key={pin.id} position={anchor}>
      <mesh onPointerDown={pick}><sphereGeometry args={[lit ? .035 : .025,10,8]} /><meshBasicMaterial color={lit ? "#b5d873" : "#bcc6ab"} depthTest={false} /></mesh>
      <mesh onPointerDown={pick}><sphereGeometry args={[.11,8,6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>;
  })}</group>;
}
