import { useState } from "react";
import { getDefinition } from "../component-library/catalog";
import { holes } from "../hardware-core/breadboard";
import { endpointKey, holeEndpoint, pinEndpoint } from "../projects/v3";
import type { KinetableProjectV4 } from "../projects/v4";
import { endpointLabel } from "./inspector";

/** At most 30 holes in a choice; keyboard users choose the physical row first. */
export function EndpointPicker({ project, label, value, onChange }: { project: KinetableProjectV4; label: string; value: string; onChange(value: string): void }) {
  const [partId,setPartId]=useState(project.components[0]?.id ?? ""), [row,setRow]=useState("A");
  const part=project.components.find(c=>c.id===partId);
  const options=part ? part.kind==="breadboard" ? holes.filter(h=>h.id.replace(/\d+$/,"")===row).map(h=>holeEndpoint(part.id,h.id)) : getDefinition(part.definitionId)!.pins.map(p=>pinEndpoint(part.id,p.id)) : [];
  return <fieldset className="endpoint-picker"><legend>{label}</legend><label><span className="visually-hidden">{label} part</span><select aria-label={`${label} part`} value={partId} onChange={e=>{setPartId(e.target.value);onChange("");}}>{project.components.map(c=><option key={c.id} value={c.id}>{getDefinition(c.definitionId)?.name}</option>)}</select></label>{part?.kind==="breadboard" && <label>Row or rail<select aria-label={`${label} row or rail`} value={row} onChange={e=>{setRow(e.target.value);onChange("");}}><optgroup label="Terminal rows">{"ABCDEFGHIJ".split("").map(r=><option key={r}>{r}</option>)}</optgroup><optgroup label="Continuous power rails">{["L+","L-","R+","R-"].map(r=><option key={r}>{r}</option>)}</optgroup></select></label>}<label><span className="visually-hidden">{label} endpoint</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="">Choose {part?.kind==="breadboard" ? "hole" : "pin"}</option>{options.map(e=><option key={endpointKey(e)} value={endpointKey(e)}>{endpointLabel(project,e)}</option>)}</select></label></fieldset>;
}
