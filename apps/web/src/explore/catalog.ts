import { getDefinition } from "../component-library/catalog";
import { compatibility } from "../component-library/compatibility";
import type { InventoryItem } from "../persistence/inventoryRepository";
import type { BoardId } from "../hardware/boards";

export type ExploreIdea = { id: string; name: string; description: string; learn: string; difficulty: "First build" | "Next step";
  boards: BoardId[]; required: Record<string,number>; intent: string; starter?: "bonk"; simulation: string };
export const exploreIdeas: readonly ExploreIdea[] = [
  { id:"blink-led", name:"Blink an LED", description:"Make a light pulse on and off.", learn:"See how a board output drives a protected LED.", difficulty:"First build", boards:["esp32-dev-module","raspberry-pi-pico","arduino-uno"], required:{"led-5mm":1,"resistor-220r":1}, intent:"Blink an LED using a series resistor.", simulation:"A supported circuit can run the Blink LED recipe." },
  { id:"button-led", name:"Button controls LED", description:"Press a real input and watch a light respond.", learn:"Connect a button input to an LED output through board logic.", difficulty:"First build", boards:["esp32-dev-module","raspberry-pi-pico","arduino-uno"], required:{"push-button":1,"led-5mm":1,"resistor-220r":1}, intent:"Make a button control an LED.", simulation:"A supported circuit can run the Button LED recipe." },
  { id:"motion-alarm", name:"Motion alarm", description:"Motion trips an audible response.", learn:"Understand a PIR input and a buzzer output.", difficulty:"Next step", boards:["esp32-dev-module","raspberry-pi-pico"], required:{"hc-sr501":1,"grove-buzzer-v1-1":1}, intent:"Make a motion alarm with a PIR sensor and buzzer.", simulation:"A supported circuit can run the Motion alarm recipe." },
  { id:"temperature-display", name:"Temperature display", description:"Put sensor readings on an OLED.", learn:"Follow a DHT11 reading into an I²C display.", difficulty:"Next step", boards:["esp32-dev-module","raspberry-pi-pico"], required:{"dht11-module":1,"oled-ssd1306-i2c-3v3":1}, intent:"Show DHT11 temperature and humidity on an OLED.", simulation:"A supported circuit can run the Temperature display recipe." },
  { id:"bonk", name:"BONK", description:"A button triggers light, display and two buzzer pulses.", learn:"Explore one input causing several timed outputs.", difficulty:"Next step", boards:["esp32-dev-module"], required:{"push-button":1,"led-5mm":1,"resistor-220r":1,"grove-buzzer-v1-1":1,"oled-ssd1306-i2c-3v3":1}, intent:"A button, display, LED and buzzer build.", starter:"bonk", simulation:"The deterministic BONK starter is ready to simulate." },
];
for (const idea of exploreIdeas) {
  if (!idea.boards.length || Object.entries(idea.required).some(([id,quantity]) => !getDefinition(id) || !Number.isInteger(quantity) || quantity < 1 || idea.boards.some(board=>compatibility(id,board).status!=="supported"))) throw new Error(`Invalid Explore idea ${idea.id}`);
}
export function matchIdea(idea: ExploreIdea, selectedBoard: BoardId, inventory: InventoryItem[]) {
  const board = idea.boards.includes(selectedBoard) ? selectedBoard : idea.boards[0];
  const required = { [board]: 1, ...idea.required };
  const owned = new Map(inventory.map(item => [item.definitionId,item.quantity]));
  const missing = Object.entries(required).map(([id,need])=>({ id, need, have: owned.get(id) ?? 0, missing: Math.max(0,need-(owned.get(id)??0)) })).filter(item=>item.missing>0);
  const compatible = idea.boards.includes(selectedBoard) && Object.keys(idea.required).every(id=>compatibility(id,selectedBoard).status==="supported");
  const status = compatible && !missing.length ? "ready" : compatible && inventory.some(item=>item.quantity>0) ? "almost" : "supported";
  return { board, required, missing, status, compatible, missingCount: missing.reduce((n,item)=>n+item.missing,0) };
}
export function recommendIdeas(selectedBoard: BoardId, inventory: InventoryItem[]) {
  return exploreIdeas.map(idea=>({idea,match:matchIdea(idea,selectedBoard,inventory)})).sort((a,b)=>
    Number(b.match.status==="ready")-Number(a.match.status==="ready") || Number(b.match.compatible)-Number(a.match.compatible) ||
    a.match.missingCount-b.match.missingCount || a.idea.name.localeCompare(b.idea.name));
}
