/** Kinetable half-size 400-hole board: 30 terminal columns and four continuous 25-hole rails. */
export const BREADBOARD_ID = "breadboard-half-400";
export type Hole = { id: string; x: number; y: number; strip: string };
const letters = "ABCDEFGHIJ";
export const holes: readonly Hole[] = [
  ...Array.from({ length: 30 }, (_, column) => [...letters].map((letter, row) => ({
    id: `${letter}${column + 1}`,
    x: (row < 5 ? -.58 + row * .105 : .16 + (row - 5) * .105),
    y: 1.31 - column * .09,
    strip: `${row < 5 ? "left" : "right"}-${column + 1}`,
  }))).flat(),
  ...["L+", "L-", "R+", "R-"].flatMap((rail, row) => Array.from({ length: 25 }, (_, column) => ({
    id: `${rail}${column + 1}`,
    x: [-1.02, -.86, .86, 1.02][row],
    y: 1.2 - column * .1,
    strip: rail,
  }))),
];
const byId = new Map(holes.map(hole => [hole.id, hole]));
const byStrip = new Map<string, Hole[]>();
for (const hole of holes) byStrip.set(hole.strip, [...(byStrip.get(hole.strip) ?? []), hole]);
export const getHole = (id: string): Hole | undefined => byId.get(id);
export const connectedHoles = (id: string): readonly Hole[] => byStrip.get(byId.get(id)?.strip ?? "") ?? [];
