import { useRef } from "react";
import { ScrollStory } from "./ScrollStory";
import { LearningTeaser } from "./LearningTeaser";
import { FinalCTA } from "./FinalCTA";
export function LandingPage() {
  const dialog = useRef<HTMLDialogElement>(null);
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
          <button onClick={() => dialog.current?.showModal()}>Sign in</button>
          <a className="button small" href="#product">
            Open Kinetable <span>↗</span>
          </a>
        </div>
      </header>
      <main>
        <ScrollStory />
        <LearningTeaser />
        <FinalCTA />
      </main>
      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <form method="dialog">
          <p className="eyebrow">A little more time at the workbench.</p>
          <h2>Kinetable is taking shape.</h2>
          <p>
            Accounts aren’t available yet.
            <br />
            For now, take a look around the product preview.
          </p>
          <button className="button">
            Back to exploring <span>↗</span>
          </button>
        </form>
      </dialog>
    </>
  );
}
