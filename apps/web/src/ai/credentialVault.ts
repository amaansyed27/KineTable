const memory = new Map<string, string>();
const database = "kinetable-provider-vault";
type Ciphertext = { iv: Uint8Array; data: ArrayBuffer };
function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("items"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function item<T>(id: string, value?: T, remove = false): Promise<T | undefined> {
  const db = await openVault();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction("items", value === undefined && !remove ? "readonly" : "readwrite");
      const store = tx.objectStore("items");
      const request = remove ? store.delete(id) : value === undefined ? store.get(id) : store.put(value, id);
      let result: T | undefined;
      request.onsuccess = () => { result = request.result as T | undefined; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
let keyPromise: Promise<CryptoKey> | undefined;
async function deviceKey(): Promise<CryptoKey> {
  keyPromise ??= (async () => {
    const saved = await item<CryptoKey>("device-key");
    if (saved) return saved;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await item("device-key", key);
    return key;
  })().catch(error => { keyPromise = undefined; throw error; });
  return keyPromise;
}
export const credentialVault = {
  async put(id: string, secret: string, remember: boolean): Promise<void> {
    if (!secret.trim()) throw new Error("Enter an API key.");
    memory.set(id, secret);
    if (!remember) { await item(`secret:${id}`, undefined, true); return; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deviceKey(), new TextEncoder().encode(secret));
    await item<Ciphertext>(`secret:${id}`, { iv, data });
  },
  async get(id: string): Promise<string | null> {
    if (memory.has(id)) return memory.get(id)!;
    const saved = await item<Ciphertext>(`secret:${id}`);
    if (!saved) return null;
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: saved.iv as BufferSource }, await deviceKey(), saved.data)); }
    catch { return null; }
  },
  async remove(id: string): Promise<void> { memory.delete(id); await item(`secret:${id}`, undefined, true); },
};
