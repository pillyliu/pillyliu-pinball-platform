import { Route, Routes } from "react-router-dom";
import LibraryIndex from "./pages/LibraryIndex";
import GamePage from "./pages/GamePage";
import RulesheetPage from "./pages/RulesheetPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryIndex />} />
      <Route path="/game/:slug" element={<GamePage />} />
      <Route path="/rules/:slug" element={<RulesheetPage />} />
    </Routes>
  );
}
