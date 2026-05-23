import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  OfflineQueuePanel,
  OfflineQueueProvider,
  OfflineStatusBanner,
} from "./offlineQueue/context";
import LoginPage from "./pages/LoginPage";
import EmergencyPage from "./pages/EmergencyPage";
import AdminDashboard from "./pages/AdminDashboard";
import VolunteerPage from "./pages/VolunteerPage";
import ShelterOfferPage from "./pages/ShelterOfferPage";
import PsychologicalSupportPage from "./pages/PsychologicalSupportPage";
import ProfilePage from "./pages/ProfilePage";
import QRCardPage from "./pages/QRCardPage";
import QRScanResultPage from "./pages/QRScanResultPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import OperationsLayout from "./pages/Operations/OperationsLayout";
import OperationsDashboardPage from "./pages/Operations/DashboardPage";
import OperationsMapPage from "./pages/Operations/MapPage";
import OperationsEarthquakesPage from "./pages/Operations/EarthquakesPage";
import OperationsLogisticsPage from "./pages/Operations/LogisticsPage";
import OperationsAnnouncementsPage from "./pages/Operations/OperationsAnnouncementsPage";

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
      <Route path="/" element={<Navigate to="/ops" replace />} />
      <Route
        path="/ops"
        element={
          <ProtectedRoute>
            <OperationsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OperationsDashboardPage />} />
        <Route path="map" element={<OperationsMapPage />} />
        <Route path="earthquakes" element={<OperationsEarthquakesPage />} />
        <Route path="logistics" element={<OperationsLogisticsPage />} />
        <Route path="announcements" element={<OperationsAnnouncementsPage />} />
      </Route>
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
      <Route path="/duyurular" element={<AnnouncementsPage />} />
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
