import type { KinetableProjectV2 } from "../projects/v2.js";

export class WorkbenchHistory {
  private projectId: string | null = null;
  private past: KinetableProjectV2[] = [];
  private future: KinetableProjectV2[] = [];
  constructor(private limit = 75) {}
  reset(id: string) { this.projectId = id; this.past = []; this.future = []; }
  ensure(id: string) { if (this.projectId !== id) this.reset(id); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get size() { return this.past.length; }
  record(before: KinetableProjectV2) {
    this.ensure(before.id);
    this.past.push(structuredClone(before));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undoTarget() { return this.past.at(-1); }
  redoTarget() { return this.future.at(-1); }
  finishUndo(current: KinetableProjectV2) { this.past.pop(); this.future.push(structuredClone(current)); }
  finishRedo(current: KinetableProjectV2) { this.future.pop(); this.past.push(structuredClone(current)); }
}

export function restoreRevision(snapshot: KinetableProjectV2, current: KinetableProjectV2): KinetableProjectV2 {
  return { ...structuredClone(snapshot), metadata: { ...snapshot.metadata, createdAt: current.metadata.createdAt,
    updatedAt: new Date(Math.max(Date.now(), Date.parse(current.metadata.updatedAt) + 1)).toISOString() } };
}
