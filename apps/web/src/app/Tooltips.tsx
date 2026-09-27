import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Tooltips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let target: HTMLElement | null = null;
    function hide() { clearTimeout(timer); target?.removeAttribute("aria-describedby"); target = null; setTip(null); }
    function show(event: Event) {
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-tooltip]");
      if (!element || element === target) return;
      hide(); target = element;
      timer = setTimeout(() => {
        if (!target?.isConnected) return;
        const rect = target.getBoundingClientRect(); target.setAttribute("aria-describedby", "workspace-tooltip");
        setTip({ text: target.dataset.tooltip!, x: Math.max(120, Math.min(innerWidth - 120, rect.left + rect.width / 2)), y: rect.top < 65 ? rect.bottom + 10 : rect.top - 10, below: rect.top < 65 });
      }, 350);
    }
    function leave(event: Event) { const next = (event as FocusEvent).relatedTarget; if (target && (!(next instanceof Node) || !target.contains(next))) hide(); }
    document.addEventListener("pointerover", show); document.addEventListener("focusin", show);
    document.addEventListener("pointerout", leave); document.addEventListener("focusout", leave);
    document.addEventListener("pointerdown", hide); document.addEventListener("keydown", hide); window.addEventListener("scroll", hide, true);
    return () => { hide(); document.removeEventListener("pointerover", show); document.removeEventListener("focusin", show); document.removeEventListener("pointerout", leave); document.removeEventListener("focusout", leave); document.removeEventListener("pointerdown", hide); document.removeEventListener("keydown", hide); window.removeEventListener("scroll", hide, true); };
  }, []);
  return tip ? createPortal(<div id="workspace-tooltip" role="tooltip" className="workspace-tooltip" data-below={tip.below} style={{ left: tip.x, top: tip.y }}>{tip.text}</div>, document.body) : null;
}
