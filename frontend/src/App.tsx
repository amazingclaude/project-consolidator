import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import ChatPanel from './components/layout/ChatPanel';
import { useChatStore } from './stores/chatStore';

// Lazy-loaded page components for code splitting
const Overview = React.lazy(() => import('./pages/Overview'));
const ScheduleAnalysis = React.lazy(() => import('./pages/ScheduleAnalysis'));
const CostAnalysis = React.lazy(() => import('./pages/CostAnalysis'));
const RedLineReport = React.lazy(() => import('./pages/RedLineReport'));
const ProjectDeepDive = React.lazy(() => import('./pages/ProjectDeepDive'));
const NLQuery = React.lazy(() => import('./pages/NLQuery'));
const Ingestion = React.lazy(() => import('./pages/Ingestion'));
const PlanView = React.lazy(() => import('./pages/PlanView'));
const PlanningDashboard = React.lazy(() => import('./pages/PlanningDashboard'));
const PlanForm = React.lazy(() => import('./pages/PlanForm'));
const PlanViewFY = React.lazy(() => import('./pages/PlanView_FY'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-muted">Loading...</span>
      </div>
    </div>
  );
}

export default function App() {
  const isOpen = useChatStore((s) => s.isOpen);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />

      <main
        className={`ml-64 min-h-screen transition-[margin-right] duration-300 ease-in-out ${
          isOpen ? 'mr-96' : 'mr-0'
        }`}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/schedule" element={<ScheduleAnalysis />} />
            <Route path="/cost" element={<CostAnalysis />} />
            <Route path="/red-line" element={<RedLineReport />} />
            <Route path="/projects" element={<ProjectDeepDive />} />
            <Route path="/project/:projectId" element={<ProjectDeepDive />} />
            <Route path="/plans" element={<PlanView />} />
            <Route path="/nl-query" element={<NLQuery />} />
            <Route path="/ingestion" element={<Ingestion />} />
            <Route path="/planning" element={<PlanningDashboard />} />
            <Route path="/planning/new" element={<PlanForm />} />
            <Route path="/planning/:planId" element={<PlanViewFY />} />
            <Route path="/planning/:planId/edit" element={<PlanForm />} />
          </Routes>
        </Suspense>
      </main>

      <ChatPanel />
    </div>
  );
}
