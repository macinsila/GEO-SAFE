import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  OfflineQueuePanel,
  OfflineQueueProvider,
  OfflineStatusBanner,
} from "./offlineQueue/context";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import EmergencyPage from "./pages/EmergencyPage";
import AdminDashboard from "./pages/AdminDashboard";
import VolunteerPage from "./pages/VolunteerPage";
import ShelterOfferPage from "./pages/ShelterOfferPage";
import PsychologicalSupportPage from "./pages/PsychologicalSupportPage";
import ProfilePage from "./pages/ProfilePage";
import QRCardPage from "./pages/QRCardPage";
import QRScanResultPage from "./pages/QRScanResultPage";

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && (!role || !roles.includes(role))) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
      <Route path="/emergency" element={<EmergencyPage />} />
      <Route path="/volunteer" element={<VolunteerPage />} />
      <Route path="/shelter-offer" element={<ShelterOfferPage />} />
      <Route path="/psychological-support" element={<ProtectedRoute><PsychologicalSupportPage /></ProtectedRoute>} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/qr-card" element={<ProtectedRoute><QRCardPage /></ProtectedRoute>} />
      <Route path="/qr-result" element={<QRScanResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineQueueProvider>
          <OfflineStatusBanner />
          <AppRoutes />
          <OfflineQueuePanel />
        </OfflineQueueProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
