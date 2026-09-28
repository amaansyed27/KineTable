import type { Table } from "dexie";
import { db } from "./profileRepository";
import type { ConversationMessage } from "../ai/contract";

export type ChatMessage = ConversationMessage & { id: string; provider?: string };
export type BehaviorChat = { id: string; projectId: string; ownerId: string; title: string; draft: string; messages: ChatMessage[]; updatedAt: string };
const chats: Table<BehaviorChat> = db.table("behaviorChats");
export const behaviorChatRepository = {
  async list(ownerId: string, projectId: string): Promise<BehaviorChat[]> {
    return (await chats.where("[ownerId+projectId]").equals([ownerId, projectId]).toArray()).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async save(chat: BehaviorChat): Promise<void> { await chats.put(chat); },
};
