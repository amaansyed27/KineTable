/** Physical lead positions in model-local coordinates, shared by snapping and presentation. */
export const leadAnchors: Record<string, Record<string, [number, number, number]>> = {
  "led-5mm": { anode: [-.11,-.27,.02], cathode: [.11,-.27,.02] },
  "resistor-220r": { a: [-.48,0,0], b: [.48,0,0] },
  "push-button": { a: [-.22,-.27,.02], b: [.22,-.27,.02] },
};
