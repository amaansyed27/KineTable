import { getDefinition } from "./catalog.js";
export type Compatibility = { status: "supported" | "adapter" | "unsupported" | "unknown"; reason: string };
export function compatibility(definitionId: string, boardId: string): Compatibility {
  const part = getDefinition(definitionId), board = getDefinition(boardId);
  if (!part || !board || board.kind !== "board") return { status: "unknown", reason: "This part or board has no supported profile." };
  if (part.kind === "board") return { status: part.id === board.id ? "supported" : "unsupported", reason: part.id === board.id ? "Selected board." : "Choose this board to use its profile." };
  if (part.kind === "breadboard") return { status: "supported", reason: "Kinetable models this breadboard's conductive strips." };
  if (part.signalMaxVolts && board.logicVolts && board.logicVolts > part.signalMaxVolts)
    return { status: "adapter", reason: `${board.name} uses ${board.logicVolts} V signals; this supported ${part.name} profile accepts at most ${part.signalMaxVolts} V. Level shifting is required and is not yet modeled.` };
  if (part.supply && !board.pins.some(pin => pin.role === "power" && pin.volts === part.supply))
    return { status: "unsupported", reason: `${board.name} has no modeled ${part.supply} V supply.` };
  if (part.electricalModel === "ssd1306-i2c" && !board.i2cPins)
    return { status: "unsupported", reason: "Kinetable has no modeled I²C pins for this board." };
  return { status: "supported", reason: "Supported by Kinetable's modeled electrical profile; check the physical variant before wiring." };
}
