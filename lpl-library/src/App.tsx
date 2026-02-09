import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";

const LibraryIndex = lazy(() => import("./pages/LibraryIndex"));
const GamePage = lazy(() => import("./pages/GamePage"));
const RulesheetPage = lazy(() => import("./pages/RulesheetPage"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-300">Loading...</div>}>
      <Routes>
        <Route path="/" element={<LibraryIndex />} />
        <Route path="/game/:slug" element={<GamePage />} />
        <Route path="/rules/:slug" element={<RulesheetPage />} />
      </Routes>
    </Suspense>
  );
}
