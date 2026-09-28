export type Pin = { id: string; role: "ground" | "power" | "digital-in" | "digital-out" | "digital-io" | "i2c-sda" | "i2c-scl" | "passive"; volts?: number };
export type Source = { title: string; url: string; publisher: string; type: "manufacturer" | "datasheet" | "vendor"; accessed: string };
export type Definition = {
  id: string; name: string; description: string; kind: "board" | "component" | "breadboard"; category: string;
  aliases: readonly string[]; supportedVariant: string; verification: "verified" | "profiled" | "limited"; limitations?: string;
  manufacturer?: string; model?: string; sources: readonly Source[];
  planning?: string;
  visualId: string; asset: { kind: "procedural" | "gltf"; id: string; license: string; attribution?: string; source?: string; scale?: string };
  electricalModel: "board" | "breadboard" | "led-passive" | "resistor" | "momentary-switch" | "buzzer" | "pir" | "ssd1306-i2c" | "dht11";
  pins: readonly Pin[]; supply?: 3.3 | 5; signalMaxVolts?: number; logicVolts?: number; i2cPins?: readonly [string, string];
  simulation: "supported" | "topology-dependent" | "not-modeled";
};
export function validateDefinition(value: unknown): Definition {
  const d = value as Partial<Definition> | null;
  if (!d || typeof d !== "object" || !/^[a-z][a-z0-9-]+$/.test(d.id ?? "") || (d.id?.length ?? 0) > 64 || !d.name?.trim() || !d.description?.trim() ||
    !["board", "component", "breadboard"].includes(d.kind ?? "") || !["board", "input", "output", "sensor", "passive", "breadboard"].includes(d.category ?? "") ||
    !d.supportedVariant?.trim() || !["verified", "profiled", "limited"].includes(d.verification ?? "") ||
    !Array.isArray(d.aliases) || !d.aliases.every(a => typeof a === "string" && a.length < 80) ||
    !Array.isArray(d.sources) || !d.sources.every(s => s && typeof s.title === "string" && typeof s.publisher === "string" && ["manufacturer", "datasheet", "vendor"].includes(s.type) && /^https:\/\//.test(s.url) && Number.isFinite(Date.parse(s.accessed))) ||
    d.verification === "verified" && !d.sources.some(s => s.type === "manufacturer" || s.type === "datasheet") ||
    !d.asset || d.asset.id !== d.visualId || !["procedural", "gltf"].includes(d.asset.kind) || !d.asset.license ||
    d.asset.kind === "gltf" && (!d.asset.source || !/^https:\/\//.test(d.asset.source) || !d.asset.attribution || !d.asset.scale) ||
    !["board", "breadboard", "led-passive", "resistor", "momentary-switch", "buzzer", "pir", "ssd1306-i2c", "dht11"].includes(d.electricalModel ?? "") ||
    !Array.isArray(d.pins) || new Set(d.pins.map(p => p.id)).size !== d.pins.length ||
    !d.pins.every(p => /^[a-z0-9-]+$/.test(p.id) && ["ground", "power", "digital-in", "digital-out", "digital-io", "i2c-sda", "i2c-scl", "passive"].includes(p.role)) ||
    d.supply !== undefined && d.supply !== 3.3 && d.supply !== 5 ||
    d.signalMaxVolts !== undefined && (!Number.isFinite(d.signalMaxVolts) || d.signalMaxVolts <= 0) ||
    d.kind === "board" && (!d.logicVolts || !d.i2cPins?.every(id => d.pins?.some(p => p.id === id))) ||
    !["supported", "topology-dependent", "not-modeled"].includes(d.simulation ?? "")) throw new Error("Invalid component definition");
  return d as Definition;
}
