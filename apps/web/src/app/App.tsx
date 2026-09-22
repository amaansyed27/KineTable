import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router";
import { LandingPage } from "../landing/LandingPage";
import "../styles/app.css";
const OnboardingPage = lazy(() => import("../onboarding/OnboardingPage"));
const TablePage = lazy(() => import("../table/TablePage"));
function RoutePosition() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); if (pathname === "/") document.title = "Kinetable — Small ideas, real things."; }, [pathname]);
  return null;
}
export function App() {
  return <BrowserRouter><RoutePosition /><Suspense fallback={<div className="route-loading" role="status">Opening your table…</div>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/start" element={<OnboardingPage />} />
      <Route path="/table" element={<TablePage />} />
      <Route path="*" element={<main className="route-loading"><h1>This table isn’t here.</h1><Link to="/">Back to Kinetable</Link></main>} />
    </Routes>
  </Suspense></BrowserRouter>;
}
