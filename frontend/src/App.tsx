import React from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CapsuleFormPage from './pages/CapsuleFormPage';
import CapsuleDetailPage from './pages/CapsuleDetailPage';
import ReleasePreviewPage from './pages/ReleasePreviewPage';
import AuditLogPage from './pages/AuditLogPage';
import AppLayout from './components/AppLayout';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-100">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/capsule/new"
        element={
          <ProtectedRoute>
            <CapsuleFormPage mode="create" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/capsule/:id"
        element={
          <ProtectedRoute>
            <CapsuleDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/capsule/:id/edit"
        element={
          <ProtectedRoute>
            <CapsuleFormPage mode="edit" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/releases/:id"
        element={
          <ErrorBoundary>
            <ReleasePreviewPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/audit/:id"
        element={
          <ProtectedRoute>
            <AuditLogPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Router>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
