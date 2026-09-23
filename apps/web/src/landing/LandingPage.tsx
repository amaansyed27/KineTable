import { Link } from "react-router";
import { ScrollStory } from "./ScrollStory";
import { LearningTeaser } from "./LearningTeaser";
import { FinalCTA } from "./FinalCTA";
export function LandingPage() {
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
          <Link to="/auth">Sign in</Link>
          <Link className="button small" to="/start">
            Open Kinetable <span>↗</span>
          </Link>
        </div>
      </header>
      <main>
        <ScrollStory />
        <LearningTeaser />
        <FinalCTA />
      </main>

    </>
  );
}
