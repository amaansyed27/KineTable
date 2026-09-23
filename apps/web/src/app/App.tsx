import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router";
import { LandingPage } from "../landing/LandingPage";
import "../styles/app.css";
import { AuthBoundary } from "../auth/AuthBoundary";
const AuthPage = lazy(() => import("../auth/AuthPage"));
const AuthCallback = lazy(() => import("../auth/AuthCallback"));
const OnboardingPage = lazy(() => import("../onboarding/OnboardingPage"));
const TablePage = lazy(() => import("../table/TablePage"));
const NewBuildPage = lazy(() => import("../new/NewBuildPage"));
function RoutePosition() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); if (pathname === "/") document.title = "Kinetable — Small ideas, real things."; }, [pathname]);
  return null;
}
export function App() {
  return <BrowserRouter><AuthBoundary><RoutePosition /><Suspense fallback={<div className="route-loading" role="status">Opening your table…</div>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/start" element={<OnboardingPage />} />
      <Route path="/table" element={<TablePage />} />
      <Route path="/new" element={<NewBuildPage />} />
      <Route path="*" element={<main className="route-loading"><h1>This table isn’t here.</h1><Link to="/">Back to Kinetable</Link></main>} />
    </Routes>
  </Suspense></AuthBoundary></BrowserRouter>;
}
