import { ScrollStory } from "./ScrollStory";
import { LearningTeaser } from "./LearningTeaser";
import { FinalCTA } from "./FinalCTA";
import { useAuthStore } from "../auth/authStore";
import { Link } from "react-router";
import { Trailer } from "./Trailer";
export function LandingPage() {
  const session=useAuthStore(s=>s.session);
  return (
    <>
      <a className="skip-link" href="#product">
        Skip to product preview
      </a>
      <header className="nav">
        <a className="wordmark" href="#" aria-label="Kinetable home">
          kinetable
          <span className="brand-dot" />
        </a>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#learn">Learn</a>
          <a href="#parts">Parts</a>
        </nav>
        <div className="nav-actions">
          <Link to={session ? "/home" : "/auth"}>{session ? "My projects" : "Sign in"}</Link>
          <Link className="button small" to="/home">
            Open Kinetable <span>↗</span>
          </Link>
        </div>
      </header>
      <main>
        <ScrollStory />
        <Trailer />
        <LearningTeaser />
        <FinalCTA />
      </main>

    </>
  );
}
