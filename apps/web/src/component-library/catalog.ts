export type Pin = { id: string; role: "ground" | "power" | "digital-in" | "digital-out" | "digital-io" | "i2c-sda" | "i2c-scl" | "passive"; volts?: number };
export type Definition = { id: string; name: string; kind: "board" | "component"; category: string; visualId: string; pins: readonly Pin[]; supply?: 3.3 | 5 };
const gpio = (ids: number[]): Pin[] => ids.map(id => ({ id: `gpio${id}`, role: "digital-io" }));
export const catalog: readonly Definition[] = [
  { id: "esp32-dev-module", name: "ESP32 Dev Module", kind: "board", category: "board", visualId: "esp32", pins: [...gpio([18, 19, 21, 22, 23, 27]), { id: "3v3", role: "power", volts: 3.3 }, { id: "vin", role: "power", volts: 5 }, { id: "gnd", role: "ground" }] },
  { id: "raspberry-pi-pico", name: "Raspberry Pi Pico", kind: "board", category: "board", visualId: "pico", pins: [...gpio([16, 17, 18, 19, 20, 21]), { id: "3v3", role: "power", volts: 3.3 }, { id: "vbus", role: "power", volts: 5 }, { id: "gnd", role: "ground" }] },
  { id: "arduino-uno", name: "Arduino Uno", kind: "board", category: "board", visualId: "uno", pins: [...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((id): Pin => ({ id: `d${id}`, role: "digital-io" })), { id: "a4", role: "digital-io" }, { id: "a5", role: "digital-io" }, { id: "5v", role: "power", volts: 5 }, { id: "3v3", role: "power", volts: 3.3 }, { id: "gnd", role: "ground" }] },
  { id: "led-5mm", name: "LED", kind: "component", category: "output", visualId: "led", pins: [{ id: "anode", role: "passive" }, { id: "cathode", role: "passive" }] },
  { id: "resistor-220r", name: "220 Ω resistor", kind: "component", category: "passive", visualId: "resistor", pins: [{ id: "a", role: "passive" }, { id: "b", role: "passive" }] },
  { id: "push-button", name: "Push button", kind: "component", category: "input", visualId: "button", pins: [{ id: "a", role: "passive" }, { id: "b", role: "passive" }] },
  { id: "grove-buzzer-v1-1", name: "Grove Buzzer V1.1", kind: "component", category: "output", visualId: "buzzer", pins: [{ id: "vcc", role: "power" }, { id: "gnd", role: "ground" }, { id: "sig", role: "digital-in" }], supply: 3.3 },
  { id: "hc-sr501", name: "HC-SR501 PIR", kind: "component", category: "sensor", visualId: "pir", pins: [{ id: "vcc", role: "power" }, { id: "gnd", role: "ground" }, { id: "out", role: "digital-out" }], supply: 5 },
  { id: "oled-ssd1306-i2c-3v3", name: "3.3 V SSD1306 I²C OLED", kind: "component", category: "output", visualId: "oled", pins: [{ id: "vcc", role: "power" }, { id: "gnd", role: "ground" }, { id: "sda", role: "i2c-sda" }, { id: "scl", role: "i2c-scl" }], supply: 3.3 },
  { id: "dht11-module", name: "DHT11 module", kind: "component", category: "sensor", visualId: "dht11", pins: [{ id: "vcc", role: "power" }, { id: "gnd", role: "ground" }, { id: "data", role: "digital-out" }], supply: 3.3 },
];
export const getDefinition = (id: unknown) => catalog.find(definition => definition.id === id);
export const getPin = (definitionId: string, pinId: string) => getDefinition(definitionId)?.pins.find(pin => pin.id === pinId);
