import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router";
import { LandingPage } from "../landing/LandingPage";
import "../styles/app.css";
import "../styles/interface.css";
import { Tooltips } from "./Tooltips";
import { AuthBoundary } from "../auth/AuthBoundary";
const AuthPage = lazy(() => import("../auth/AuthPage"));
const AuthCallback = lazy(() => import("../auth/AuthCallback"));
const OnboardingPage = lazy(() => import("../onboarding/OnboardingPage"));
const TablePage = lazy(() => import("../table/TablePage"));
const NewBuildPage = lazy(() => import("../new/NewBuildPage"));
const ProviderSettingsPage = lazy(() => import("../ai/ProviderSettingsPage"));
const ProjectsPage = lazy(() => import("../projects/ProjectsPage"));
const PartsPage = lazy(() => import("../parts/PartsPage"));
const AppearancePage = lazy(() => import("./AppearancePage"));
const AccountPage = lazy(() => import("../auth/AccountPage"));
function RoutePosition() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); if (pathname === "/") document.title = "Kinetable — Small ideas, real things."; }, [pathname]);
  return null;
}
function RouteScenes() {
  return <div className="route-scene"><Suspense fallback={<div className="route-loading" role="status">Opening your table…</div>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/start" element={<OnboardingPage />} />
      <Route path="/table" element={<TablePage />} />
      <Route path="/home" element={<ProjectsPage home />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/parts" element={<PartsPage />} />
      <Route path="/projects/new" element={<NewBuildPage />} />
      <Route path="/projects/:projectId" element={<TablePage />} />
      <Route path="/new" element={<Navigate to="/projects/new" replace />} />
      <Route path="/settings/appearance" element={<AppearancePage />} />
      <Route path="/settings/account" element={<AccountPage />} />
      <Route path="/settings/providers" element={<ProviderSettingsPage />} />
      <Route path="*" element={<main className="route-loading"><h1>This table isn’t here.</h1><Link to="/">Back to Kinetable</Link></main>} />
    </Routes>
  </Suspense></div>;
}
export function App() {
  return <BrowserRouter><AuthBoundary><RoutePosition /><RouteScenes /><Tooltips /></AuthBoundary></BrowserRouter>;
}
