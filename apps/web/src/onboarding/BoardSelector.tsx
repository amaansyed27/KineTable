import { lazy, Suspense, useState } from "react";
import { boards, type BoardId } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
const BoardStage = lazy(() => import("../spatial/BoardStage"));
export function BoardSelector() {
  const selected = useProfileStore(s => s.profile?.primaryBoardId);
  const selectBoard = useProfileStore(s => s.selectBoard);
  const [hovered, setHovered] = useState<BoardId | null>(null);
  return <fieldset className="board-selector"><legend className="visually-hidden">Choose your board</legend>
    <div className="board-stage" aria-hidden="true"><Suspense fallback={<p className="scene-fallback">Setting out your boards…</p>}><BoardStage selected={selected} hovered={hovered} /></Suspense></div>
    <div className="board-options">{boards.map(board => <label key={board.id} className="board-option" data-selected={selected === board.id} data-quiet={!!selected && selected !== board.id}
      onPointerEnter={() => setHovered(board.id)} onPointerLeave={() => setHovered(null)}>
      <input type="radio" name="board" value={board.id} checked={selected === board.id} aria-label={board.name} aria-describedby={`${board.id}-description`}
        onFocus={() => setHovered(board.id)} onBlur={() => setHovered(null)}
        onChange={() => void selectBoard(board.id)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void selectBoard(board.id); } }}
        onClick={() => { if (selected === board.id && useProfileStore.getState().error) void selectBoard(board.id); }} />
      <span className="board-label"><span className="board-name"><span className="selection-dot" aria-hidden="true" />{board.name}</span><span id={`${board.id}-description`} className="board-description">{board.shortDescription}</span></span>
    </label>)}</div>
  </fieldset>;
}
