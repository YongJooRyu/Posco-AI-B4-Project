import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import TownPage      from "./pages/TownPage"
import LecturePage   from "./pages/LecturePage"
import DashboardPage from "./pages/DashboardPage"
import PartyPage     from "./pages/PartyPage"


export default function App() {
  return (
    <BrowserRouter>
      <div style={{
        width: "100vw",
        height: "100vh",
        background: "#0b1220",
        display: "flex",
        flexDirection: "column",
      }}>
        <Routes>
          <Route path="/"          element={<Navigate to="/town" replace />} />
          <Route path="/town"      element={<TownPage />} />
          <Route path="/lecture"   element={<LecturePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/party"     element={<PartyPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}