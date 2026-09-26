export type Trigger =
  | { kind: "button"; componentId: string; edge: "pressed" | "released" }
  | { kind: "pir"; componentId: string }
  | { kind: "timer"; intervalMs: number }
  | { kind: "dht11"; componentId: string };
export type Condition = { kind: "dht11"; componentId: string; property: "temperatureC" | "humidityPct"; operator: "<" | "<=" | "==" | ">=" | ">"; value: number };
export type Action =
  | { kind: "led"; componentId: string; operation: "on" | "off" | "toggle" }
  | { kind: "oled"; componentId: string; operation: "show"; text: string }
  | { kind: "oled"; componentId: string; operation: "clear" }
  | { kind: "buzzer"; componentId: string; count: number; onMs: number; gapMs: number };
export type LogicRule = { id: string; enabled: boolean; when: Trigger; if: Condition[]; do: Action[] };
export const LOGIC_LIMITS = { rules: 16, conditions: 4, actions: 8, text: 32, timerMin: 100, timerMax: 60000, beeps: 8, durationMin: 20, durationMax: 2000 } as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join() === keys.sort().join();
const id = (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(v);
const bounded = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
function trigger(v: unknown): v is Trigger {
  if (!object(v)) return false;
  if (v.kind === "timer") return exact(v, ["kind", "intervalMs"]) && bounded(v.intervalMs, LOGIC_LIMITS.timerMin, LOGIC_LIMITS.timerMax);
  if (!id(v.componentId)) return false;
  if (v.kind === "button") return exact(v, ["kind", "componentId", "edge"]) && ["pressed", "released"].includes(String(v.edge));
  return ["pir", "dht11"].includes(String(v.kind)) && exact(v, ["kind", "componentId"]);
}
function condition(v: unknown): v is Condition {
  return object(v) && exact(v, ["kind", "componentId", "property", "operator", "value"]) && v.kind === "dht11" && id(v.componentId) &&
    ["temperatureC", "humidityPct"].includes(String(v.property)) && ["<", "<=", "==", ">=", ">"].includes(String(v.operator)) &&
    typeof v.value === "number" && Number.isFinite(v.value) && (v.property === "temperatureC" ? v.value >= 0 && v.value <= 50 : v.value >= 20 && v.value <= 90);
}
function action(v: unknown): v is Action {
  if (!object(v) || !id(v.componentId)) return false;
  if (v.kind === "led") return exact(v, ["kind", "componentId", "operation"]) && ["on", "off", "toggle"].includes(String(v.operation));
  if (v.kind === "oled") return (exact(v, ["kind", "componentId", "operation"]) && v.operation === "clear") ||
    (exact(v, ["kind", "componentId", "operation", "text"]) && v.operation === "show" && typeof v.text === "string" && v.text.length <= LOGIC_LIMITS.text && ![...v.text].some(char => { const code = char.codePointAt(0)!; return code < 32 || code === 127; }));
  return v.kind === "buzzer" && exact(v, ["kind", "componentId", "count", "onMs", "gapMs"]) &&
    bounded(v.count, 1, LOGIC_LIMITS.beeps) && bounded(v.onMs, LOGIC_LIMITS.durationMin, LOGIC_LIMITS.durationMax) && bounded(v.gapMs, LOGIC_LIMITS.durationMin, LOGIC_LIMITS.durationMax);
}
export function isLogic(value: unknown): value is LogicRule[] {
  return Array.isArray(value) && value.length <= LOGIC_LIMITS.rules && value.every(v => object(v) && exact(v, ["id", "enabled", "when", "if", "do"]) && id(v.id) &&
    typeof v.enabled === "boolean" && trigger(v.when) && Array.isArray(v.if) && v.if.length <= LOGIC_LIMITS.conditions && v.if.every(condition) &&
    Array.isArray(v.do) && v.do.length >= 1 && v.do.length <= LOGIC_LIMITS.actions && v.do.every(action)) &&
    new Set(value.map(v => v.id)).size === value.length;
}
