import { boards, type BoardId } from "../hardware/boards";
import { compatibility } from "../component-library/compatibility";

export type Goal = "row" | "gap" | "rail" | "led-path" | "led-on" | "led-off" | "button-path" | "button-pressed" | "button-released" | "oled-path" | "oled-text" | "bonk-logic" | "bonk-output";
export type Stage = { id: string; instruction: string; goal: Goal; hints: [string, string]; concept: string };
export type Mission = { id: string; version: number; title: string; description: string; prerequisites: string[]; parts: string[]; boards: BoardId[]; stages: Stage[] };
const allBoards = boards.map(board => board.id);
const stage = (goal: Goal, instruction: string, concept: string, hints: [string,string]): Stage => ({ id: goal, goal, instruction, concept, hints });
const ledPath = stage("led-path", "Connect GPIO → resistor → LED → ground.", "The anode receives the protected output; the cathode returns to ground. In this supported profile, a 220 Ω resistor belongs in series.", ["The LED needs a complete path back to ground.", "A resistor on a separate branch does not protect the LED. Inspect both resistor ends."]);
const ledOn = stage("led-on", "Simulate. Let the LED turn on.", "HIGH drives the supported LED path on. This is a logical result, not a current calculation.", ["Switch to Simulate after connecting the circuit.", "Choose Blink LED and press Play. Its first transition is after 500 ms."]);
const ledOff = stage("led-off", "Let the same LED turn off.", "LOW switches the output off. A simulated output does not prove a physical build.", ["Keep the simulation running.", "The Blink LED recipe alternates every 500 ms. Watch for OFF."]);
const buttonPath = stage("button-path", "Connect the button between a GPIO input and ground.", "This supported normally open switch closes two separate contacts. The input uses pull-up semantics: released is HIGH, pressed is LOW.", ["Use one button contact for GPIO and the other for ground.", "The contacts must remain on separate nets when released. Inspect their paths."]);
const oledPath = stage("oled-path", "Connect OLED power, ground, SDA and SCL.", "Power keeps the display supplied. SDA carries data; SCL provides the clock. Their canonical board pins differ by board.", ["Connect the 3.3 V supply and ground first.", "SDA and SCL are different signals. Match each to the selected board’s I²C metadata."]);
const core: Omit<Mission,"boards"|"version">[] = [
  { id:"breadboard", title:"Breadboards: rows and rails", description:"Discover which holes share a connection.", prerequisites:[], parts:["breadboard-half-400","resistor-220r"], stages:[
    stage("row", "Insert one lead from each teaching resistor into a shared terminal strip.", "Holes are positions. Electrical nets derive from the supported breadboard’s internal conductors.", ["Select each resistor in Parts & wires. Use Insert lead on its A terminal.", "Use two different holes on one side of the same numbered strip. Choose Inspect from to highlight the net."]),
    stage("gap", "Move the second teaching lead across the center gap.", "The center trench separates A–E from F–J at the same number. Visually nearby holes can be electrically separate.", ["Select the second resistor. Use Lift lead on its inserted A terminal before moving it.", "Keep the number the same and move to the other side of the trench."]),
    stage("rail", "Move both teaching leads into one power rail.", "This exact 400-hole model has four independent continuous 25-hole rails. A rail is not powered until wired to a supply; physical breadboards can vary.", ["Use Lift lead on each A terminal before reinserting it.", "Choose two different holes in one rail. Inspect the rail to see its full derived net."]),
  ] },
  { id:"led", title:"LED: direction and protection", description:"Build a protected output, then see HIGH and LOW.", prerequisites:["breadboard"], parts:["breadboard-half-400","led-5mm","resistor-220r"], stages:[ledPath,ledOn,ledOff] },
  { id:"button", title:"Button: LOW can mean pressed", description:"Build an input and follow its signal.", prerequisites:["led"], parts:["breadboard-half-400","push-button"], stages:[buttonPath,
    stage("button-pressed", "Simulate and press the button.", "The closed button connects the input to ground. Explain follows the actual input transition.", ["Switch to Simulate. The Explore signals scenario observes inputs without invented output behavior.", "Press the button in the workbench or use Press button. Look for the input becoming LOW."]),
    stage("button-released", "Release the button and observe HIGH.", "The supported pull-up restores HIGH when the contact opens. Contact bounce is not modeled.", ["Release the same button.", "Use Explain → Signals or Why? to follow the released input trace."]),
  ] },
  { id:"brightness", title:"Brightness: what a resistor does", description:"Understand current limiting without fabricated precision.", prerequisites:["led"], parts:["led-5mm","resistor-220r"], stages:[ledPath,ledOn,ledOff] },
  { id:"oled", title:"OLED: power and I²C", description:"Wire four distinct paths and display HELLO.", prerequisites:["button"], parts:["oled-ssd1306-i2c-3v3"], stages:[oledPath,
    stage("oled-text", "In Logic, add a Timer rule that shows HELLO on the OLED. Simulate it.", "Saved Visual Logic drives the same semantic I²C runtime. No physical protocol waveform is modeled.", ["Open Logic → Manual. Add a Timer trigger and an OLED Show action.", "Set the display text to HELLO, save the rule, then Simulate → Play."]),
  ] },
  { id:"bonk", title:"BONK", description:"One input. Light, sound and display. Bring it together.", prerequisites:["breadboard","led","button","brightness","oled"], parts:["breadboard-half-400","push-button","led-5mm","resistor-220r","grove-buzzer-v1-1","oled-ssd1306-i2c-3v3"], stages:[buttonPath,ledPath,oledPath,
    stage("bonk-logic", "Inspect the saved button behavior in Logic.", "This is the canonical BONK starter, partially assembled so you can focus on how one input drives several outputs.", ["Open Logic. The saved rule uses the actual button and outputs.", "Find the enabled Button pressed rule: OLED BONK!, LED ON, buzzer ×2."]),
    stage("bonk-output", "Simulate and press the button. Follow the BONK signal path.", "The runtime records the button input, rule match, OLED text, LED drive and timed buzzer sequence. Explain reads this evidence.", ["Switch to Simulate, press Play and press the button.", "Use Why? beside the OLED or LED to follow the causal chain."]),
  ] },
];
export const missions: readonly Mission[] = core.map(mission => ({ ...mission, version:1, boards: mission.id === "bonk" ? ["esp32-dev-module"] : allBoards.filter(board => mission.parts.every(part => compatibility(part,board).status === "supported")) }));
export const getMission = (id: string | undefined) => missions.find(mission => mission.id === id);
