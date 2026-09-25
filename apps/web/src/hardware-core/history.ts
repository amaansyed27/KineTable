import type { KinetableProjectV3 } from "../projects/v3.js";

export class WorkbenchHistory {
  private projectId: string | null = null;
  private past: KinetableProjectV3[] = [];
  private future: KinetableProjectV3[] = [];
  constructor(private limit = 75) {}
  reset(id: string) { this.projectId = id; this.past = []; this.future = []; }
  ensure(id: string) { if (this.projectId !== id) this.reset(id); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get size() { return this.past.length; }
  record(before: KinetableProjectV3) {
    this.ensure(before.id);
    this.past.push(structuredClone(before));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undoTarget() { return this.past.at(-1); }
  redoTarget() { return this.future.at(-1); }
  finishUndo(current: KinetableProjectV3) { this.past.pop(); this.future.push(structuredClone(current)); }
  finishRedo(current: KinetableProjectV3) { this.future.pop(); this.past.push(structuredClone(current)); }
}

export function restoreRevision(snapshot: KinetableProjectV3, current: KinetableProjectV3): KinetableProjectV3 {
  return { ...structuredClone(snapshot), metadata: { ...snapshot.metadata, createdAt: current.metadata.createdAt,
    updatedAt: new Date(Math.max(Date.now(), Date.parse(current.metadata.updatedAt) + 1)).toISOString() } };
}
