import { ScrollStory } from "./ScrollStory";
import { LearningTeaser } from "./LearningTeaser";
import { FinalCTA } from "./FinalCTA";
import { useAuthStore } from "../auth/authStore";
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
          <a href={session ? "/home" : "/auth"}>{session ? "My projects" : "Sign in"}</a>
          <a className="button small" href="/home">
            Open Kinetable <span>↗</span>
          </a>
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
