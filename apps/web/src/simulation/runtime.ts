import { powerNet, type CompiledCircuit } from "./compileCircuit.js";
import { type Recipe } from "./recipes.js";
import type { CompiledBehaviorProgram, CompiledRule } from "../logic/compile.js";

export type Signal = { kind: "unknown" } | { kind: "digital"; value: 0 | 1 } | { kind: "voltage"; volts: number } | { kind: "ground" } | { kind: "data"; protocol: "dht11" | "i2c"; value: string };
export type TraceEvent = { id: number; timeMs: number; code: string; componentId?: string; pinId?: string; netId?: string; value?: string; causedBy?: number; ruleId?: string; actionIndex?: number };
type Event = { timeMs: number; sequence: number; action: "blink" | "pir-off" | "buzzer-off" | "buzzer-on" | "timer"; causedBy?: number; componentId?: string; pin?: string; ruleId?: string };
export type Snapshot = { timeMs: number; signals: Record<string, Signal>; outputs: Record<string, { on?: boolean; text?: string; pressed?: boolean; motion?: boolean; temperatureC?: number; humidityPct?: number }>; trace: TraceEvent[]; error?: string };
const MAX_QUEUE = 2048, MAX_ADVANCE = 4096, MAX_TRACE = 1000;

export class SimulationRuntime {
  timeMs = 0;
  error?: string;
  private sequence = 0;
  get version() { return this.sequence; }
  private events: Event[] = [];
  private trace: TraceEvent[] = [];
  private signals = new Map<string, Signal>();
  private outputs: Snapshot["outputs"] = {};
  private pirToken = new Map<string, number>();
  constructor(readonly circuit: CompiledCircuit, readonly recipe: Recipe | CompiledBehaviorProgram) {
    for (const net of circuit.nets) {
      const power = powerNet(circuit, net.id);
      this.signals.set(net.id, power === "ground" ? { kind: "ground" } : typeof power === "number" ? { kind: "voltage", volts: power } : { kind: "unknown" });
    }
    for (const binding of circuit.bindings) this.outputs[binding.id] = {};

    if (recipe.id === "project-logic") {
      for (const button of recipe.inputs.buttons) this.outputs[button.id] = { pressed: false };
      for (const pir of recipe.inputs.pirs) { this.outputs[pir.id] = { motion: false }; this.setInput(recipe.inputPins[pir.id], 0); }
      for (const dht of recipe.inputs.dhts) this.outputs[dht.id] = { temperatureC: 24, humidityPct: 50 };
      for (const led of recipe.outputs.leds) this.outputs[led.component.id] = { on: false };
      for (const buzzer of recipe.outputs.buzzers) this.outputs[buzzer.component.id] = { on: false };
      for (const oled of recipe.outputs.oleds) this.outputs[oled.component.id] = { text: "" };
      for (const rule of recipe.rules) if (rule.enabled && rule.when.kind === "timer") this.schedule(rule.when.intervalMs, "timer", undefined, undefined, undefined, rule.id);
      for (const button of recipe.inputs.buttons) {
        const pin = recipe.inputPins[button.id];
        if (pin) this.runRules("button", button.id, "released", this.setInput(pin, 1, this.record("button.release", { componentId: button.id, value: "RELEASED" })));
      }
    } else {
      if (recipe.button && recipe.buttonPin) this.setInput(recipe.buttonPin, 1);
      if (recipe.pir && recipe.pirPin) this.setInput(recipe.pirPin, 0);
      if (recipe.dht) this.outputs[recipe.dht.id] = { temperatureC: 24, humidityPct: 50 };
      if (recipe.led) this.outputs[recipe.led.id] = { on: false };
      if (recipe.buzzer) this.outputs[recipe.buzzer.id] = { on: false };
      if (recipe.oled) this.outputs[recipe.oled.id] = { text: recipe.id === "bonk" ? "READY" : "" };
      if (recipe.id === "blink-led") this.schedule(500, "blink");
      if (recipe.id === "dht11-oled") this.setEnvironment(24, 50);
    }
  }
  private record(code: string, data: Omit<TraceEvent, "id" | "timeMs" | "code"> = {}): number {
    const id = ++this.sequence;
    this.trace.push({ id, timeMs: this.timeMs, code, ...data });
    if (this.trace.length > MAX_TRACE) this.trace.splice(0, this.trace.length - MAX_TRACE);
    return id;
  }
  private schedule(timeMs: number, action: Event["action"], causedBy?: number, componentId?: string, pin?: string, ruleId?: string) {
    if (!Number.isFinite(timeMs) || timeMs < this.timeMs || this.events.length >= MAX_QUEUE) throw new Error("Simulation event limit reached.");
    this.events.push({ timeMs, action, causedBy, componentId, pin, ruleId, sequence: ++this.sequence });
    this.events.sort((a,b) => a.timeMs - b.timeMs || a.sequence - b.sequence);
  }
  private setInput(pin: string, value: 0 | 1, causedBy?: number) {
    const netId = this.circuit.board.pins[pin];
    this.signals.set(netId, { kind: "digital", value });
    return this.record("gpio.input", { componentId: this.circuit.board.id, pinId: pin, netId, value: value ? "HIGH" : "LOW", causedBy });
  }
  private drive(pin: string, value: 0 | 1, causedBy: number) {
    const netId = this.circuit.board.pins[pin];
    this.signals.set(netId, { kind: "digital", value });
    const drive = this.record("gpio.output", { componentId: this.circuit.board.id, pinId: pin, netId, value: value ? "HIGH" : "LOW", causedBy });
    const leds = this.recipe.id === "project-logic" ? this.recipe.outputs.leds.filter(b => b.boardPin === pin).map(b => b.component) : this.recipe.led && pin === this.recipe.ledPin ? [this.recipe.led] : [];
    for (const led of leds) {
      this.outputs[led.id] = { on: !!value };
      this.signals.set(led.pins.anode, { kind: "digital", value }); // Supported 220 Ω series path; current is not modeled.
      this.record("led.state", { componentId: led.id, pinId: "anode", netId: led.pins.anode, value: value ? "ON" : "OFF", causedBy: drive });
    }
    const buzzers = this.recipe.id === "project-logic" ? this.recipe.outputs.buzzers.filter(b => b.boardPin === pin).map(b => b.component) : this.recipe.buzzer && pin === this.recipe.buzzerPin ? [this.recipe.buzzer] : [];
    for (const buzzer of buzzers) {
      this.outputs[buzzer.id] = { on: !!value };
      this.record("buzzer.state", { componentId: buzzer.id, pinId: "sig", netId: buzzer.pins.sig, value: value ? "ON" : "OFF", causedBy: drive });
    }
  }
  private display(text: string, causedBy: number, componentId?: string) {
    const oled = componentId ? this.circuit.bindings.find(b => b.id === componentId) : this.recipe.id === "project-logic" ? undefined : this.recipe.oled;
    if (!oled) return;
    const sent = this.record("i2c.text", { componentId: this.circuit.board.id, netId: oled.pins.sda, value: text, causedBy });
    this.signals.set(oled.pins.sda, { kind: "data", protocol: "i2c", value: text });
    this.outputs[oled.id] = { text };
    this.record("oled.text", { componentId: oled.id, netId: oled.pins.sda, value: text, causedBy: sent });
  }
  private runRules(kind: "button" | "pir" | "dht11" | "timer", componentId: string | undefined, edge: "pressed" | "released" | undefined, causedBy: number, timerRuleId?: string) {
    if (this.recipe.id !== "project-logic") return;
    for (const rule of this.recipe.rules) {
      if (!rule.enabled || rule.when.kind !== kind || (timerRuleId && rule.id !== timerRuleId) || ("componentId" in rule.when && rule.when.componentId !== componentId) || (rule.when.kind === "button" && rule.when.edge !== edge)) continue;
      const conditionCause = this.conditionsPass(rule, causedBy);
      if (conditionCause === false) continue;
      const match = this.record("logic.rule.match", { ruleId: rule.id, value: rule.id, causedBy: conditionCause });
      rule.do.forEach((action, actionIndex) => {
        const applied = this.record("logic.action", { ruleId: rule.id, actionIndex, componentId: action.componentId, value: action.kind === "buzzer" ? `BEEP ×${action.count}` : action.kind === "oled" ? action.operation === "show" ? action.text : "CLEAR" : action.operation.toUpperCase(), causedBy: match });
        if (action.kind === "led" && action.boardPin) this.drive(action.boardPin, action.operation === "toggle" ? this.outputs[action.componentId].on ? 0 : 1 : action.operation === "on" ? 1 : 0, applied);
        if (action.kind === "oled") this.display(action.operation === "show" ? action.text ?? "" : "", applied, action.componentId);
        if (action.kind === "buzzer" && action.boardPin) {
          this.drive(action.boardPin, 1, applied);
          for (let i = 0; i < action.count; i++) {
            this.schedule(this.timeMs + i * (action.onMs + action.gapMs) + action.onMs, "buzzer-off", applied, action.componentId, action.boardPin);
            if (i + 1 < action.count) this.schedule(this.timeMs + (i + 1) * (action.onMs + action.gapMs), "buzzer-on", applied, action.componentId, action.boardPin);
          }
        }
      });
    }
  }
  private conditionsPass(rule: CompiledRule, causedBy: number) {
    let cause = causedBy;
    for (const condition of rule.if) {
      const actual = this.outputs[condition.componentId][condition.property];
      const value = typeof actual === "number" ? actual : NaN;
      const pass = condition.operator === "<" ? value < condition.value : condition.operator === "<=" ? value <= condition.value : condition.operator === "==" ? value === condition.value : condition.operator === ">=" ? value >= condition.value : value > condition.value;
      cause = this.record(pass ? "logic.condition.true" : "logic.condition.false", { ruleId: rule.id, componentId: condition.componentId, pinId: condition.boardPin, netId: condition.netId, value: `${condition.property}: ${value} ${condition.operator} ${condition.value}`, causedBy: cause });
      if (!pass) return false;
    }
    return cause;
  }
  setButton(componentId: string, pressed: boolean) {
    if (this.error) return;
    try {
      const button = this.recipe.id === "project-logic" ? this.recipe.inputs.buttons.find(b => b.id === componentId) : this.recipe.button;
      const pin = this.recipe.id === "project-logic" ? this.recipe.inputPins[componentId] : this.recipe.buttonPin;
      if (!button || !pin) throw new Error("This button has no supported input path.");
      if (this.outputs[componentId].pressed === pressed) return;
      this.outputs[componentId] = { pressed };
      const action = this.record(pressed ? "button.press" : "button.release", { componentId, value: pressed ? "PRESSED" : "RELEASED" });
      const input = this.setInput(pin, pressed ? 0 : 1, action);
      if (this.recipe.id === "project-logic") this.runRules("button", componentId, pressed ? "pressed" : "released", input);
      if (this.recipe.id === "button-led" || this.recipe.id === "bonk") {
        const reaction = this.record(`recipe.${this.recipe.id}`, { causedBy: input });
        if (this.recipe.ledPin) this.drive(this.recipe.ledPin, pressed ? 1 : 0, reaction);
        if (this.recipe.id === "bonk") {
          this.display(pressed ? "BONK!" : "READY", reaction);
          if (pressed && this.recipe.buzzerPin) {
            this.drive(this.recipe.buzzerPin, 1, reaction);
            this.schedule(this.timeMs + 120, "buzzer-off", reaction);
            this.schedule(this.timeMs + 220, "buzzer-on", reaction);
            this.schedule(this.timeMs + 340, "buzzer-off", reaction);
          }
        }
      }
    } catch (error) { this.fail(error); }
  }
  triggerPir(componentId: string) {
    if (this.error || this.pirToken.get(componentId) === this.timeMs + 1000) return;
    try {
      const pir = this.recipe.id === "project-logic" ? this.recipe.inputs.pirs.find(b => b.id === componentId) : this.recipe.pir;
      const pin = this.recipe.id === "project-logic" ? this.recipe.inputPins[componentId] : this.recipe.pirPin;
      if (!pir || !pin) throw new Error("This PIR has no supported input path.");
      this.outputs[componentId] = { motion: true };
      const action = this.record("pir.trigger", { componentId, value: "MOTION" });
      const input = this.setInput(pin, 1, action);
      if (this.recipe.id === "project-logic") this.runRules("pir", componentId, undefined, input);
      if (this.recipe.id === "motion-alarm" && this.recipe.buzzerPin) this.drive(this.recipe.buzzerPin, 1, this.record("recipe.motion-alarm", { causedBy: input }));
      this.pirToken.set(componentId, this.timeMs + 1000);
      this.schedule(this.timeMs + 1000, "pir-off", input, componentId);
    } catch (error) { this.fail(error); }
  }
  setEnvironment(temperatureC: number, humidityPct: number, componentId?: string) {
    if (this.error) return;
    try {
      if (!Number.isFinite(temperatureC) || !Number.isFinite(humidityPct) || temperatureC < 0 || temperatureC > 50 || humidityPct < 20 || humidityPct > 90) throw new Error("DHT11 values must be 0–50 °C and 20–90% humidity.");
      const dht = this.recipe.id === "project-logic" ? componentId ? this.recipe.inputs.dhts.find(b => b.id === componentId) : this.recipe.inputs.dhts[0] : this.recipe.dht;
      const pin = this.recipe.id === "project-logic" ? this.recipe.inputPins[dht?.id ?? ""] : this.recipe.dhtPin;
      if (!dht || !pin) throw new Error("No supported DHT11 data path.");
      if (this.recipe.id === "project-logic" && this.outputs[dht.id].temperatureC === temperatureC && this.outputs[dht.id].humidityPct === humidityPct) return;
      this.outputs[dht.id] = { temperatureC, humidityPct };
      const action = this.record("dht.environment", { componentId: dht.id, value: `${temperatureC} °C · ${humidityPct}%` });
      const netId = dht.pins.data;
      this.signals.set(netId, { kind: "data", protocol: "dht11", value: `${temperatureC} °C · ${humidityPct}%` });
      const read = this.record("dht.read", { componentId: this.circuit.board.id, pinId: pin, netId, value: `${temperatureC} °C · ${humidityPct}%`, causedBy: action });
      if (this.recipe.id === "project-logic") this.runRules("dht11", dht.id, undefined, read);
      if (this.recipe.id === "dht11-oled") this.display(`${temperatureC}°C  ${humidityPct}%`, this.record("recipe.dht11-oled", { causedBy: read }));
    } catch (error) { this.fail(error); }
  }
  advanceBy(ms: number) { this.advanceTo(this.timeMs + ms); }
  advanceTo(targetTimeMs: number) {
    if (this.error) return;
    try {
      if (!Number.isFinite(targetTimeMs) || targetTimeMs < this.timeMs) throw new Error("Simulation time must move forward.");
      let processed = 0;
      while (this.events[0] && this.events[0].timeMs <= targetTimeMs) {
        if (++processed > MAX_ADVANCE) throw new Error("Simulation event limit reached.");
        const event = this.events.shift()!;
        this.timeMs = event.timeMs;
        if (event.action === "timer" && this.recipe.id === "project-logic" && event.ruleId) {
          const rule = this.recipe.rules.find(r => r.id === event.ruleId && r.when.kind === "timer");
          if (rule && rule.when.kind === "timer") {
            const tick = this.record("timer.tick", { ruleId: rule.id });
            this.runRules("timer", undefined, undefined, tick, rule.id);
            this.schedule(this.timeMs + rule.when.intervalMs, "timer", tick, undefined, undefined, rule.id);
          }
        } else if (event.action === "blink" && this.recipe.id !== "project-logic" && this.recipe.ledPin && this.recipe.led) {
          const on = !this.outputs[this.recipe.led.id].on;
          this.drive(this.recipe.ledPin, on ? 1 : 0, this.record("recipe.blink-led", { causedBy: event.causedBy }));
          this.schedule(this.timeMs + 500, "blink");
        } else if (event.action === "pir-off" && event.componentId && this.pirToken.get(event.componentId) === event.timeMs && (this.recipe.id === "project-logic" ? this.recipe.inputPins[event.componentId] : this.recipe.pirPin)) {
          this.outputs[event.componentId] = { motion: false };
          const off = this.record("pir.clear", { componentId: event.componentId, causedBy: event.causedBy });
          const input = this.setInput(this.recipe.id === "project-logic" ? this.recipe.inputPins[event.componentId] : this.recipe.pirPin!, 0, off);
          if (this.recipe.id === "motion-alarm" && this.recipe.buzzerPin) this.drive(this.recipe.buzzerPin, 0, this.record("recipe.motion-alarm", { causedBy: input }));
        } else if (event.action === "buzzer-off" || event.action === "buzzer-on") {
          const pin = event.pin ?? (this.recipe.id === "project-logic" ? undefined : this.recipe.buzzerPin);
          if (pin) this.drive(pin, event.action === "buzzer-on" ? 1 : 0, this.record(this.recipe.id === "project-logic" ? "logic.beep" : "recipe.bonk.beep", { causedBy: event.causedBy, componentId: event.componentId }));
        }
      }
      this.timeMs = targetTimeMs;
    } catch (error) { this.fail(error); }
  }
  private fail(error: unknown) { this.error = error instanceof Error ? error.message : "Simulation stopped."; this.events = []; }
  snapshot(): Snapshot { return { timeMs: this.timeMs, signals: Object.fromEntries(this.signals), outputs: structuredClone(this.outputs), trace: [...this.trace], ...(this.error ? { error: this.error } : {}) }; }
}
