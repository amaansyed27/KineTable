import { create } from "zustand";
export type Theme = "system" | "light" | "dark";
const key = "kinetable.appearance";
function preference(): Theme { try { const value = localStorage.getItem(key); return value === "light" || value === "dark" ? value : "system"; } catch { return "system"; } }
export function applyTheme(theme: Theme) { if (typeof document === "undefined") return; document.documentElement.dataset.theme = theme === "system" ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : theme; }
export const useAppearance = create<{ theme: Theme; error: string | null; setTheme(theme: Theme): void }>((set) => ({ theme: preference(), error: null, setTheme: theme => {
  applyTheme(theme); try { localStorage.setItem(key, theme); set({ theme, error: null }); } catch { set({ theme, error: "Appearance changed for this session. Browser storage is unavailable." }); }
} }));
if (typeof window !== "undefined") {
applyTheme(useAppearance.getState().theme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(useAppearance.getState().theme));
window.addEventListener("storage", event => { if (event.key === key) { const theme = preference(); useAppearance.setState({ theme }); applyTheme(theme); } });

}
