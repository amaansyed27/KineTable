import { boardPin, byModel, powerNet, sameNet, type Binding, type CompiledCircuit } from "./compileCircuit.js";
import type { Definition } from "../component-library/catalog.js";

export type DriverBinding = { component: Binding; boardPin?: string; resistor?: Binding };
type Driver = { bind(circuit: CompiledCircuit): DriverBinding[] };
const grounded = (circuit: CompiledCircuit, binding: Binding, pin: string) => powerNet(circuit, binding.pins[pin]) === "ground";
const gpio = (model: Definition["electricalModel"], pin: string): Driver => ({ bind: circuit => byModel(circuit, model).flatMap(component => {
  const pinId = boardPin(circuit, component, pin);
  return pinId && powerNet(circuit, component.pins.vcc) === component.definition.supply && grounded(circuit, component, "gnd") ? [{ component, boardPin: pinId }] : [];
}) });
const powered = (model: Definition["electricalModel"]): Driver => ({ bind: circuit => byModel(circuit, model).filter(component => {
  const supply = component.definition.supply;
  return powerNet(circuit, component.pins.vcc) === supply && grounded(circuit, component, "gnd");
}).map(component => ({ component })) });

/** The registry binds canonical electrical models to verified graph relationships. Runtime actions use these bindings, never visual IDs. */
export const driverRegistry: Partial<Record<Definition["electricalModel"], Driver>> = {
  board: { bind: circuit => [ { component: circuit.board } ] },
  breadboard: { bind: circuit => byModel(circuit,"breadboard").map(component => ({ component })) },
  resistor: { bind: circuit => byModel(circuit,"resistor").map(component => ({ component })) },
  "momentary-switch": { bind: circuit => byModel(circuit,"momentary-switch").flatMap(component => ["a","b"].flatMap(pin => {
    const other = pin === "a" ? "b" : "a", pinId = boardPin(circuit, component, pin);
    return pinId && grounded(circuit, component, other) ? [{ component, boardPin: pinId }] : [];
  })) },
  "led-passive": { bind: circuit => byModel(circuit,"led-passive").flatMap(component => byModel(circuit,"resistor").flatMap(resistor => ["a","b"].flatMap(end => {
    const other = end === "a" ? "b" : "a", pinId = boardPin(circuit, resistor, other);
    return pinId && sameNet(component,"anode",resistor,end) && grounded(circuit,component,"cathode") ? [{ component, boardPin: pinId, resistor }] : [];
  }))) },
  pir: gpio("pir","out"),
  buzzer: gpio("buzzer","sig"),
  dht11: gpio("dht11","data"),
  "ssd1306-i2c": { bind: circuit => powered("ssd1306-i2c").bind(circuit).filter(({component}) => {
    const expected = circuit.board.definition.id === "esp32-dev-module" ? ["gpio21","gpio22"] : circuit.board.definition.id === "raspberry-pi-pico" ? ["gpio20","gpio21"] : ["a4","a5"];
    return sameNet(component,"sda",circuit.board,expected[0]) && sameNet(component,"scl",circuit.board,expected[1]);
  }) },
};
export function bindDriver(circuit: CompiledCircuit, model: Definition["electricalModel"]): DriverBinding[] { return driverRegistry[model]?.bind(circuit) ?? []; }
