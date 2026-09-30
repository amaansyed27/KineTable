import { useEffect, useRef, useState } from "react";
import "./trailer.css";
export function Trailer() {
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (playing) void video.current?.play().catch(() => undefined); }, [playing]);
  return <section className="landing-trailer" aria-labelledby="trailer-title">
    <div className="trailer-copy"><h2 id="trailer-title">An idea.<br />A real project.</h2><p>Describe what you want to build.<br />Kinetable proposes the hardware. You approve.<br />Your project opens on the table.</p></div>
    <div className="trailer-frame">
      {playing ? <video ref={video} src="/media/kinetable-trailer.mp4" poster="/media/kinetable-trailer-poster.webp" controls playsInline preload="none" aria-label="Kinetable product trailer" /> : <button className="trailer-play" onClick={() => setPlaying(true)} aria-label="Play Kinetable trailer">
        <img src="/media/kinetable-trailer-poster.webp" alt="Kinetable hardware workspace from the product trailer" width="1920" height="1080" loading="lazy" decoding="async" />
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" /></svg> Watch the film <small>22 seconds</small></span>
      </button>}
    </div>
  </section>;
}
