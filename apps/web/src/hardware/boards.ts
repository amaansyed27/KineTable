export const boards = [
  { id: "esp32-dev-module", name: "ESP32", shortDescription: "Versatile · Wi-Fi + Bluetooth", family: "esp32", visualId: "esp32", capabilities: ["wifi", "bluetooth"] },
  { id: "raspberry-pi-pico", name: "Raspberry Pi Pico", shortDescription: "Simple · Fast · Flexible", family: "rp2040", visualId: "pico", capabilities: [] },
  { id: "arduino-uno", name: "Arduino Uno", shortDescription: "A familiar place to start", family: "avr", visualId: "uno", capabilities: [] },
] as const;
export type BoardDefinition = (typeof boards)[number];
export type BoardId = BoardDefinition["id"];
export function getBoard(id: unknown) { return boards.find(board => board.id === id); }
