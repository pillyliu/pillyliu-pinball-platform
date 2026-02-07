import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const LibraryIndex = lazy(() => import("./pages/LibraryIndex"));
const GamePage = lazy(() => import("./pages/GamePage"));
const RulesheetPage = lazy(() => import("./pages/RulesheetPage"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LibraryIndex />} />
        <Route path="/game/:slug" element={<GamePage />} />
        <Route path="/rules/:slug" element={<RulesheetPage />} />
      </Routes>
    </Suspense>
  );
}
