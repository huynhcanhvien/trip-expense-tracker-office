import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Trips from "./pages/Trips.jsx";
import TripDetail from "./pages/TripDetail.jsx";

// NOTE: login is bypassed (demo mode). The <Login /> page still exists in
// pages/Login.jsx — re-add the gate here when you turn auth back on.
export default function App() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div className="center-screen"><div className="empty"><span className="big">🌸</span>Loading Petal…</div></div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Trips />} />
      <Route path="/trips/:id" element={<TripDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
