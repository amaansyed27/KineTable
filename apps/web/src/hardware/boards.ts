import { getDefinition } from "../component-library/catalog.js";
const boardDetails = [
  { id: "esp32-dev-module", displayName: "ESP32", shortDescription: "Versatile · Wi-Fi + Bluetooth", family: "esp32", capabilities: ["wifi", "bluetooth"] },
  { id: "raspberry-pi-pico", shortDescription: "Simple · Fast · Flexible", family: "rp2040", capabilities: [] },
  { id: "arduino-uno", shortDescription: "A familiar place to start", family: "avr", capabilities: [] },
] as const;
export const boards = boardDetails.map(board => ({ ...board, name: "displayName" in board ? board.displayName : getDefinition(board.id)!.name, visualId: getDefinition(board.id)!.visualId }));
export type BoardDefinition = (typeof boards)[number];
export type BoardId = (typeof boardDetails)[number]["id"];
export function getBoard(id: unknown) { return boards.find(board => board.id === id); }
