import { useState } from "react";
import { Link } from "react-router";
import { AppShell } from "../app/AppShell";
import { credentialVault } from "./credentialVault";
import { addRoute, loadProviderSettings, reorder, saveProviderSettings, type ProviderSettings } from "./providerSettings";
import { bridgeConnected, connectBridge, discoverRoute, manageLocalRoute, testRoute } from "./providerTransport";
import { remotePreset, remotePresets } from "./remoteCatalog";
import { maskSecret, type CredentialMeta, type RouteCandidate } from "./routing";

const options = [
  ...remotePresets.map(p => ({ id: p.id, name: p.name, transport: "REMOTE_API" as const })),
  { id: "custom", name: "Custom OpenAI-compatible", transport: "CUSTOM_OPENAI_COMPATIBLE" as const },
  ...["ollama", "lmstudio", "vllm"].map(id => ({ id, name: id === "lmstudio" ? "LM Studio" : id === "vllm" ? "vLLM" : "Ollama", transport: "LOCAL_HTTP" as const })),
  ...["codex", "agy", "claude", "kimi", "opencode", "continue"].map(id => ({ id, name: ({ codex: "Codex CLI", agy: "Antigravity CLI", claude: "Claude Code", kimi: "Kimi Code", opencode: "OpenCode", continue: "Continue CLI" } as Record<string, string>)[id], transport: "LOCAL_CLI" as const })),
];
function label(route: RouteCandidate) { return route.name || options.find(o => o.id === route.providerId)?.name || route.providerId; }
function routeType(route: RouteCandidate) { return route.transport === "LOCAL_CLI" ? "Local CLI" : route.transport === "LOCAL_HTTP" ? "Local" : "Your key"; }
export default function ProviderSettingsPage() {
  const [settings, setSettings] = useState<ProviderSettings>(loadProviderSettings);
  const [chosen, setChosen] = useState("ollama");
  const [bridgeToken, setBridgeToken] = useState("");
  const [bridgeState, setBridgeState] = useState(bridgeConnected() ? "Connected" : "Not connected");
  const [message, setMessage] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, { label: string; secret: string; remember: boolean }>>({});
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [manageAllowed, setManageAllowed] = useState<Record<string, boolean>>({});
  function update(next: ProviderSettings) { setSettings(next); saveProviderSettings(next); }
  function updateRoute(id: string, change: Partial<RouteCandidate>) { update({ ...settings, profile: { ...settings.profile, routes: settings.profile.routes.map(route => route.id === id ? { ...route, ...change } : route) } }); }
  function add() {
    const option = options.find(o => o.id === chosen)!;
    update(addRoute(settings, { providerId: option.id, transport: option.transport, modelId: "", ...(option.transport === "LOCAL_HTTP" ? { baseUrl: `http://127.0.0.1:${option.id === "ollama" ? 11434 : option.id === "lmstudio" ? 1234 : 8000}` } : {}), ...(option.id === "custom" ? { authMode: "bearer" as const } : {}) }));
  }
  async function addKey(route: RouteCandidate) {
    const value = draft[route.id];
    if (!value?.label.trim() || value.secret.trim().length < 8) { setMessage({ ...message, [route.id]: "Enter a key label and an API key of at least 8 characters." }); return; }
    const id = crypto.randomUUID();
    try {
      await credentialVault.put(id, value.secret, value.remember);
      const credential: CredentialMeta = { id, providerId: route.providerId, label: value.label.trim().slice(0, 40), priority: settings.credentials.filter(c => c.providerId === route.providerId).length, enabled: true, lastFour: value.secret.slice(-4), remembered: value.remember };
      update({ profile: { ...settings.profile, routes: settings.profile.routes.map(r => r.id === route.id ? { ...r, credentialIds: [...r.credentialIds, id] } : r) }, credentials: [...settings.credentials, credential] });
      setDraft({ ...draft, [route.id]: { label: "", secret: "", remember: false } });
      setMessage({ ...message, [route.id]: "Key added." });
    } catch { setMessage({ ...message, [route.id]: "Couldn’t save the key on this device." }); }
  }
  async function removeKey(id: string) {
    await credentialVault.remove(id);
    update({ credentials: settings.credentials.filter(c => c.id !== id), profile: { ...settings.profile, routes: settings.profile.routes.map(route => ({ ...route, credentialIds: route.credentialIds.filter(value => value !== id) })) } });
  }
  async function check(route: RouteCandidate) {
    setMessage({ ...message, [route.id]: "Checking…" });
    try {
      const id = route.credentialIds.find(value => settings.credentials.find(c => c.id === value)?.enabled) ?? null;
      await testRoute(route, id);
      setMessage(current => ({ ...current, [route.id]: "Connected · structured plan accepted" }));
    } catch (error) { setMessage(current => ({ ...current, [route.id]: error instanceof Error ? error.message.replaceAll("_", " ").toLowerCase() : "Connection failed" })); }
  }
  async function discover(route: RouteCandidate) {
    try {
      const found = await discoverRoute(route, route.credentialIds.find(value => settings.credentials.find(c => c.id === value)?.enabled) ?? null);
      setModels({ ...models, [route.id]: found.models ?? [] });
      setMessage({ ...message, [route.id]: found.models?.length ? `${found.models.length} installed models found.` : found.available ? `Installed · ${found.version ?? "version available"}` : "Runtime unavailable." });
    } catch { setMessage({ ...message, [route.id]: "Local Bridge is not running or this runtime is unavailable." }); }
  }
  return <AppShell title="AI providers" tableNav><main id="app-main" className="provider-settings">
    <p className="eyebrow">KINETABLE / PROVIDERS</p><h1>Choose how Kinetable plans.</h1>
    <p className="settings-intro">Use a local model, an authenticated local CLI, or your own API key. Kinetable uses your provider directly. Keys stay on this device unless stated otherwise; remote requests send a key to Kinetable’s server for that request only.</p>
    <Link className="settings-back" to="/table">← Back to your table</Link>
    <section className="settings-section"><h2>Local Bridge</h2><p>Local models and CLIs need the optional bridge running on this computer. From a Kinetable checkout, run <code>pnpm bridge</code>, then paste the token printed in its terminal. Set <code>KINETABLE_BRIDGE_ORIGIN</code> to this site’s origin when using a preview.</p>
      <div className="settings-row"><label>Bridge token<input type="password" autoComplete="off" value={bridgeToken} onChange={e => setBridgeToken(e.target.value)} /></label><button type="button" onClick={() => void connectBridge(bridgeToken).then(() => setBridgeState("Connected")).catch(() => setBridgeState("Bridge unavailable. Check the bridge, token, and browser local-network permission.")).finally(() => setBridgeToken(""))}>Connect</button><span role="status">{bridgeState}</span></div></section>
    <section className="settings-section"><h2>Routing</h2><p>Routes are tried from top to bottom. Keys for the same provider are tried in their displayed order. A safety refusal or hardware validation failure stops the chain.</p>
      <div className="settings-row"><label>Add provider<select value={chosen} onChange={e => setChosen(e.target.value)}>{options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}</select></label><button type="button" onClick={add}>Add route</button></div>
      {settings.profile.routes.length === 0 && <p>No provider is configured yet. Add Ollama, a CLI, or your own API key to build.</p>}
      {[...settings.profile.routes].sort((a, b) => a.priority - b.priority).map(route => <article className="settings-route" key={route.id}>
        <div className="settings-route-head"><div><small>{routeType(route)}</small><h3>{label(route)}</h3></div><div className="settings-row"><button type="button" aria-label={`Move ${label(route)} up`} onClick={() => update({ ...settings, profile: { ...settings.profile, routes: reorder(settings.profile.routes, route.id, -1) } })}>↑</button><button type="button" aria-label={`Move ${label(route)} down`} onClick={() => update({ ...settings, profile: { ...settings.profile, routes: reorder(settings.profile.routes, route.id, 1) } })}>↓</button><label className="settings-check"><input type="checkbox" checked={route.enabled} onChange={e => updateRoute(route.id, { enabled: e.target.checked })} /> Enabled</label><button type="button" onClick={() => update({ ...settings, profile: { ...settings.profile, routes: settings.profile.routes.filter(r => r.id !== route.id) } })}>Remove</button></div></div>
        <div className="settings-row">{route.transport === "CUSTOM_OPENAI_COMPATIBLE" && <label>Name<input value={route.name ?? ""} onChange={e => updateRoute(route.id, { name: e.target.value.slice(0, 60) })} placeholder="My gateway" /></label>}<label>Model ID<input value={route.modelId} onChange={e => updateRoute(route.id, { modelId: e.target.value })} placeholder={route.transport === "LOCAL_CLI" ? "CLI default" : "Choose an available model"} /></label>{(route.transport === "CUSTOM_OPENAI_COMPATIBLE" || route.transport === "REMOTE_API" && !remotePreset(route.providerId)?.baseUrl) && <label>Public HTTPS base URL<input value={route.baseUrl ?? ""} onChange={e => updateRoute(route.id, { baseUrl: e.target.value })} placeholder="https://example.com/v1" /></label>}{route.transport === "CUSTOM_OPENAI_COMPATIBLE" && <label>Authentication<select value={route.authMode ?? "bearer"} onChange={e => updateRoute(route.id, { authMode: e.target.value as RouteCandidate["authMode"] })}><option value="bearer">Bearer key</option><option value="x-api-key">x-api-key header</option><option value="none">No key</option></select></label>}{route.transport === "LOCAL_HTTP" && <label>Local URL<input value={route.baseUrl ?? ""} onChange={e => updateRoute(route.id, { baseUrl: e.target.value })} /></label>}</div>
        {(route.transport === "REMOTE_API" || route.transport === "CUSTOM_OPENAI_COMPATIBLE" && route.authMode !== "none") && <div className="settings-keys"><h4>API keys</h4>{route.credentialIds.map(id => settings.credentials.find(c => c.id === id)).filter((c): c is CredentialMeta => !!c).sort((a, b) => a.priority - b.priority).map(key => <div className="settings-row" key={key.id}><span>{key.label} {maskSecret(key.lastFour)} {key.remembered ? "· remembered here" : "· this session"}</span><button type="button" aria-label={`Move ${key.label} up`} onClick={() => update({ ...settings, credentials: [...settings.credentials.filter(c => c.providerId !== route.providerId), ...reorder(settings.credentials.filter(c => c.providerId === route.providerId), key.id, -1)] })}>↑</button><button type="button" aria-label={`Move ${key.label} down`} onClick={() => update({ ...settings, credentials: [...settings.credentials.filter(c => c.providerId !== route.providerId), ...reorder(settings.credentials.filter(c => c.providerId === route.providerId), key.id, 1)] })}>↓</button><label className="settings-check"><input type="checkbox" checked={key.enabled} onChange={e => update({ ...settings, credentials: settings.credentials.map(c => c.id === key.id ? { ...c, enabled: e.target.checked } : c) })} /> Enabled</label><button type="button" onClick={() => void removeKey(key.id)}>Remove</button></div>)}
          <div className="settings-row"><label>Key label<input value={draft[route.id]?.label ?? ""} onChange={e => setDraft({ ...draft, [route.id]: { ...draft[route.id], label: e.target.value, secret: draft[route.id]?.secret ?? "", remember: draft[route.id]?.remember ?? false } })} placeholder="Personal" /></label><label>API key<input type="password" autoComplete="off" value={draft[route.id]?.secret ?? ""} onChange={e => setDraft({ ...draft, [route.id]: { ...draft[route.id], label: draft[route.id]?.label ?? "", secret: e.target.value, remember: draft[route.id]?.remember ?? false } })} /></label><label className="settings-check"><input type="checkbox" checked={draft[route.id]?.remember ?? false} onChange={e => setDraft({ ...draft, [route.id]: { ...draft[route.id], label: draft[route.id]?.label ?? "", secret: draft[route.id]?.secret ?? "", remember: e.target.checked } })} /> Remember on this device</label><button type="button" onClick={() => void addKey(route)}>Add key</button></div></div>}
        <div className="settings-row"><button type="button" onClick={() => void discover(route)}>Find models / status</button><button type="button" onClick={() => void check(route)}>Test connection</button><span role="status">{message[route.id]}</span></div>
        {route.transport === "LOCAL_HTTP" && <div className="settings-row"><label className="settings-check"><input type="checkbox" checked={!!manageAllowed[route.id]} onChange={e => { const allowed = e.target.checked; void manageLocalRoute(route, "permit", allowed).then(() => setManageAllowed(current => ({ ...current, [route.id]: allowed }))).catch(() => setMessage(current => ({ ...current, [route.id]: "Connect the Local Bridge first." }))); }} /> Allow Kinetable to start and stop this provider</label><button type="button" disabled={!manageAllowed[route.id]} onClick={() => void manageLocalRoute(route, "start").then(() => setMessage(current => ({ ...current, [route.id]: "Start requested. Check status in a moment." }))).catch(error => setMessage(current => ({ ...current, [route.id]: error instanceof Error ? error.message.replaceAll("_", " ").toLowerCase() : "Couldn’t start runtime." })))}>Start</button><button type="button" disabled={!manageAllowed[route.id]} onClick={() => void manageLocalRoute(route, "stop").then(() => setMessage(current => ({ ...current, [route.id]: "Stopped bridge-owned runtime." }))).catch(error => setMessage(current => ({ ...current, [route.id]: error instanceof Error ? error.message.replaceAll("_", " ").toLowerCase() : "Couldn’t stop runtime." })))}>Stop</button></div>}
        {!!models[route.id]?.length && <label>Installed models<select value={route.modelId} onChange={e => updateRoute(route.id, { modelId: e.target.value })}><option value="">Choose a model</option>{models[route.id].map(model => <option key={model} value={model}>{model}</option>)}</select></label>}
      </article>)}
    </section>
  </main></AppShell>;
}
