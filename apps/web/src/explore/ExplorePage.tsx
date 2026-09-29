import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { useAuthStore } from "../auth/authStore";
import { useProfileStore } from "../state/profileStore";
import { useProjectStore } from "../state/projectStore";
import { useInventory } from "../persistence/useInventory";
import { getDefinition } from "../component-library/catalog";
import { exploreIdeas, matchIdea, recommendIdeas } from "./catalog";
import "./explore.css";

function ExploreContent() {
  const { ideaId } = useParams(), navigate = useNavigate();
  const profile = useProfileStore(s=>s.profile), session = useAuthStore(s=>s.session);
  const inventory = useInventory(); const [busy,setBusy]=useState(false), [error,setError]=useState<string|null>(null);
  const selectedBoard = profile?.primaryBoardId ?? "esp32-dev-module";
  const idea = exploreIdeas.find(item=>item.id===ideaId);
  if (ideaId && !idea) return <main id="app-main" className="explore-page"><h1>This build isn’t here.</h1><Link to="/explore">Explore ideas</Link></main>;
  const matches = recommendIdeas(selectedBoard,inventory.rows);
  async function start() {
    if (!idea || busy) return;
    setBusy(true); setError(null);
    try {
      const board = matchIdea(idea,selectedBoard,inventory.rows).board;
      let document;
      if (idea.starter === "bonk") document = await useProjectStore.getState().tryBonk();
      else {
        await useProjectStore.getState().open(board,session);
        document = await useProjectStore.getState().createBuild(board,idea.intent,idea.name);
      }
      navigate(`/projects/${document.id}`);
    } catch { setError("Couldn’t save this project on this device. Try again."); }
    finally { setBusy(false); }
  }
  if (idea) {
    const match = matchIdea(idea,selectedBoard,inventory.rows);
    return <main id="app-main" className="explore-page"><Link className="explore-back" to="/explore">← Explore</Link><div className="explore-detail"><div><p className="eyebrow">{idea.difficulty} / {idea.boards.map(id=>getDefinition(id)?.name).join(" · ")}</p><h1>{idea.name}</h1><p className="explore-lead">{idea.description}</p><h2>What you’ll understand</h2><p>{idea.learn}</p><h2>In Kinetable</h2><p>{idea.simulation} {idea.starter ? "Starting creates the real validated circuit." : "Starting creates a blank project with this idea. Build it manually or use Ask Kinetable if configured."}</p><button className="button" disabled={busy} onClick={()=>void start()}>Start project <span aria-hidden="true">→</span></button><p className="explore-note">No AI provider needed. My Parts quantities stay the same.</p>{error && <p role="alert">{error}</p>}</div><section className="explore-hardware" aria-labelledby="hardware-title"><h2 id="hardware-title">Hardware for this build</h2><p>{match.status==="ready"?"You have everything.":match.status==="supported"?"Supported in Kinetable":`Missing ${match.missing.map(item=>`${item.missing} ${getDefinition(item.id)?.name}`).join(", ")}`}</p><ul>{Object.entries(match.required).map(([id,need])=>{const have=inventory.rows.find(item=>item.definitionId===id)?.quantity??0;return <li key={id}><span className="part-glyph" data-visual={getDefinition(id)?.visualId} aria-hidden="true" /><div><strong>{getDefinition(id)?.name}</strong><small>{need} needed · {have} in My Parts</small></div><span>{have>=need?"Owned":`${need-have} missing`}</span></li>;})}</ul>{!inventory.rows.some(row=>row.quantity>0) && <p>Your shelf is empty. <Link to="/parts">Add your parts</Link> to see what you can build now.</p>}</section></div></main>;
  }
  return <main id="app-main" className="explore-page"><header className="explore-heading"><p className="eyebrow">EXPLORE / YOUR NEXT BUILD</p><h1>Built around your parts.</h1><p>Real projects Kinetable can model. Pick an idea, then make it yours.</p>{!inventory.rows.some(row=>row.quantity>0) && <p>Your shelf is empty. <Link to="/parts">Add hardware to My Parts</Link> for personal matches.</p>}</header>{inventory.error && <p role="alert">{inventory.error}</p>}{!inventory.loaded && <p role="status">Checking My Parts…</p>}<div className="explore-list">{matches.map(({idea,match},index)=><article key={idea.id} className="explore-idea"><span className="explore-index">{String(index+1).padStart(2,"0")}</span><div><p className="eyebrow">{idea.difficulty} · {getDefinition(match.board)?.name}</p><h2><Link to={`/explore/${idea.id}`}>{idea.name}</Link></h2><p>{idea.description}</p><small>{Object.entries(match.required).map(([id,qty])=>`${getDefinition(id)?.name}${qty>1?` ×${qty}`:""}`).join(" · ")}</small></div><div className="explore-idea-action"><strong>{match.status==="ready"?"You have everything":match.status==="supported"?"Supported in Kinetable":`Missing ${match.missingCount} ${match.missingCount===1?"part":"parts"}`}</strong><Link to={`/explore/${idea.id}`}>View build →</Link></div></article>)}</div></main>;
}
export default function ExplorePage() { return <AppShell title="Explore"><ProfileGate><ExploreContent /></ProfileGate></AppShell>; }
