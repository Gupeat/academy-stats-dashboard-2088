import { Navigate, Route, Routes } from "react-router-dom";
import { AcademyStatsPage } from "./pages/AcademyStatsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/academy/stats" element={<AcademyStatsPage />} />
      <Route path="*" element={<Navigate to="/academy/stats" replace />} />
    </Routes>
  );
}
