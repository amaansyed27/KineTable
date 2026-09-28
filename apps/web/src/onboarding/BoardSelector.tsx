import { lazy, Suspense, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { boards, type BoardId } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
const BoardStage = lazy(() => import("../spatial/BoardStage"));
export function BoardSelector() {
  const selected = useProfileStore(s => s.profile?.primaryBoardId);
  const selectBoard = useProfileStore(s => s.selectBoard);
  const [hovered, setHovered] = useState<BoardId | null>(null);
  const reduced = useReducedMotion();
  return <fieldset className="board-selector"><legend className="visually-hidden">Choose your board</legend>
    <div className="board-stage" aria-hidden="true"><Suspense fallback={<p className="scene-fallback">Setting out your boards…</p>}><BoardStage selected={selected} hovered={hovered} /></Suspense></div>
    <LayoutGroup id="starting-board"><div className="board-options">{boards.map(board => <label key={board.id} className="board-option" data-selected={selected === board.id} data-quiet={!!selected && selected !== board.id}
      onPointerEnter={() => setHovered(board.id)} onPointerLeave={() => setHovered(null)}>
      <input type="radio" name="board" value={board.id} checked={selected === board.id} aria-label={board.name} aria-describedby={`${board.id}-description`}
        onFocus={() => setHovered(board.id)} onBlur={() => setHovered(null)}
        onChange={() => void selectBoard(board.id)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void selectBoard(board.id); } }}
        onClick={() => { if (selected === board.id && useProfileStore.getState().error) void selectBoard(board.id); }} />
      <span className="board-label"><span className="board-name">{board.name}</span><span id={`${board.id}-description`} className="board-description">{board.shortDescription}</span>{selected === board.id && <motion.span aria-hidden="true" className="board-selection-mark" layoutId="selected-board" transition={{ duration: reduced ? 0 : .26, ease: [.16, 1, .3, 1] }}><svg viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" /></svg></motion.span>}</span>
    </label>)}</div></LayoutGroup>
  </fieldset>;
}
