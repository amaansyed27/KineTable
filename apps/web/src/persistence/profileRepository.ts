import Dexie, { type Table } from "dexie";
import { getBoard, type BoardId } from "../hardware/boards";
export type HardwareProfile = { primaryBoardId: BoardId; setupCompleted: boolean; updatedAt: string; cloudUserId?: string; cloudDirty?: boolean };
export const db = new Dexie("kinetable");
db.version(1).stores({ profiles: "id" });
db.version(2).stores({ profiles: "id", projects: "id, cloudUserId, updatedAt" });
const profiles: Table<HardwareProfile & { id: string }> = db.table("profiles");
export function isProfile(value: unknown): value is HardwareProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<HardwareProfile>;
  return !!getBoard(p.primaryBoardId) && typeof p.setupCompleted === "boolean" &&
    typeof p.updatedAt === "string" && Number.isFinite(Date.parse(p.updatedAt));
}
let writes = Promise.resolve();
export const profileRepository = {
  async load(): Promise<HardwareProfile | null> {
    const value = await profiles.get("local");
    return isProfile(value) ? { primaryBoardId: value.primaryBoardId, setupCompleted: value.setupCompleted, updatedAt: value.updatedAt, cloudUserId: typeof value.cloudUserId === "string" ? value.cloudUserId : undefined, cloudDirty: value.cloudDirty === true } : null;
  },
  save(profile: HardwareProfile): Promise<void> {
    if (!isProfile(profile)) return Promise.reject(new Error("Invalid hardware profile"));
    // Serialize rapid selection changes so a slower write cannot restore an older board.
    const operation = writes.catch(() => {}).then(async () => { await profiles.put({ ...profile, id: "local" }); });
    writes = operation;
    return operation;
  },
};
