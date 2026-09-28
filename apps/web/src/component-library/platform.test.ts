import { expect, it } from "vitest";
import { catalog, getDefinition } from "./catalog";
import { compatibility } from "./compatibility";
import { validateDefinition } from "./schema";
import { searchLibrary } from "./search";
import { plannerHardwareContext } from "../ai/prompt";

it("keeps all saved definition IDs unique and valid", () => {
  const ids = ["esp32-dev-module","raspberry-pi-pico","arduino-uno","led-5mm","resistor-220r","push-button","grove-buzzer-v1-1","hc-sr501","oled-ssd1306-i2c-3v3","dht11-module","breadboard-half-400"];
  expect(catalog.map(d=>d.id)).toEqual(ids);
  expect(catalog.every(d=>validateDefinition(d)===d)).toBe(true);
  expect(()=>validateDefinition({...catalog[0],pins:[...catalog[0].pins,catalog[0].pins[0]]})).toThrow();
  expect(()=>validateDefinition({...catalog[0],verification:"verified",sources:[]})).toThrow();
  expect(()=>validateDefinition({...catalog[0],supply:9})).toThrow();
  expect(()=>validateDefinition({...catalog[0],asset:{kind:"gltf",id:catalog[0].visualId,license:"unknown"}})).toThrow();
});
it("derives board compatibility and search without visual IDs", () => {
  expect(compatibility("oled-ssd1306-i2c-3v3","esp32-dev-module").status).toBe("supported");
  expect(compatibility("oled-ssd1306-i2c-3v3","arduino-uno").status).toBe("adapter");
  expect(compatibility("hc-sr501","esp32-dev-module").status).toBe("supported");
  expect(compatibility("push-button","raspberry-pi-pico").status).toBe("supported");
  expect(compatibility("unknown","esp32-dev-module").status).toBe("unknown");
  const oled=getDefinition("oled-ssd1306-i2c-3v3")!;
  const old=oled.visualId; oled.visualId="different";
  try { expect(compatibility(oled.id,"arduino-uno").status).toBe("adapter"); } finally { oled.visualId=old; }
  expect(searchLibrary({query:"motion sensor"}).map(d=>d.id)).toContain("hc-sr501");
  expect(searchLibrary({boardId:"arduino-uno",compatibleOnly:true}).map(d=>d.id)).not.toContain(oled.id);
});
it("planner facts come from canonical definitions", () => {
  const request={projectId:"id",revision:"now",intent:"show text",boardId:"esp32-dev-module"};
  const oled=getDefinition("oled-ssd1306-i2c-3v3")!;
  const before=plannerHardwareContext(request).components.find(d=>d.id===oled.id);
  const old=oled.supportedVariant; oled.supportedVariant="test profile";
  try { expect(plannerHardwareContext(request).components.find(d=>d.id===oled.id)?.supportedVariant).toBe("test profile"); }
  finally { oled.supportedVariant=old; }
  expect(before?.supportedVariant).toBe(old);
});
