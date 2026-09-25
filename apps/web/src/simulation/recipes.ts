import { boardPin, type Binding, type CompiledCircuit } from "./compileCircuit.js";
import { bindDriver } from "./drivers.js";

export type RecipeId = "blink-led" | "button-led" | "motion-alarm" | "dht11-oled" | "bonk" | "explore";
export type Recipe = { id: RecipeId; name: string; description: string; button?: Binding; buttonPin?: string; pir?: Binding; pirPin?: string; dht?: Binding; dhtPin?: string; led?: Binding; ledPin?: string; resistor?: Binding; buzzer?: Binding; buzzerPin?: string; oled?: Binding };
const descriptor: Record<RecipeId, [string,string]> = {
  "blink-led": ["Blink LED", "A deterministic 500 ms on/off cycle."],
  "button-led": ["Button controls LED", "The grounded button pulls a board input LOW."],
  "motion-alarm": ["Motion alarm", "A simulated PIR pulse drives the buzzer."],
  "dht11-oled": ["Temperature display", "DHT11 values appear on the OLED over a semantic I²C link."],
  bonk: ["BONK", "Button, LED, OLED and two timed buzzer pulses."],
  explore: ["Explore signals", "Inspect supported inputs and supply paths without a behavior recipe."],
};
const make = (id: RecipeId, parts: Partial<Recipe> = {}): Recipe => ({ id, name: descriptor[id][0], description: descriptor[id][1], ...parts });
const distinctPins = (...pins: (string | undefined)[]) => pins.every((pin): pin is string => !!pin) && new Set(pins).size === pins.length;

export function availableRecipes(circuit: CompiledCircuit): Recipe[] {
  const buttonBinding = bindDriver(circuit,"momentary-switch")[0];
  const ledBinding = bindDriver(circuit,"led-passive")[0];
  const pirBinding = bindDriver(circuit,"pir")[0];
  const buzzerBinding = bindDriver(circuit,"buzzer")[0];
  const dhtBinding = bindDriver(circuit,"dht11")[0];
  const oledBinding = bindDriver(circuit,"ssd1306-i2c")[0];
  const button = buttonBinding && { button: buttonBinding.component, buttonPin: buttonBinding.boardPin };
  const led = ledBinding && { led: ledBinding.component, ledPin: ledBinding.boardPin, resistor: ledBinding.resistor };
  const pir = pirBinding && { pir: pirBinding.component, pirPin: pirBinding.boardPin };
  const buzzer = buzzerBinding && { buzzer: buzzerBinding.component, buzzerPin: buzzerBinding.boardPin };
  const dht = dhtBinding && { dht: dhtBinding.component, dhtPin: dhtBinding.boardPin };
  const oled = oledBinding?.component;
  const oledSda = oled ? boardPin(circuit, oled, "sda") : undefined;
  const oledScl = oled ? boardPin(circuit, oled, "scl") : undefined;
  const recipes = [
    led && make("blink-led", led),
    button && led && distinctPins(button.buttonPin, led.ledPin) && make("button-led", { ...button, ...led }),
    pir && buzzer && distinctPins(pir.pirPin, buzzer.buzzerPin) && make("motion-alarm", { ...pir, ...buzzer }),
    dht && oled && distinctPins(dht.dhtPin, oledSda, oledScl) && make("dht11-oled", { ...dht, oled }),
    button && led && buzzer && oled && circuit.board.definition.id === "esp32-dev-module" && distinctPins(button.buttonPin, led.ledPin, buzzer.buzzerPin, oledSda, oledScl) && make("bonk", { ...button, ...led, ...buzzer, oled }),
  ].filter((r): r is Recipe => !!r);
  return [...recipes, make("explore", { ...button, ...pir, ...dht, ...led, ...buzzer, oled })];
}
