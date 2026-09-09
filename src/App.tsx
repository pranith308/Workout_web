import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { PlanListScreen } from './screens/PlanListScreen';
import { DayViewScreen } from './screens/DayViewScreen';
import { ExerciseListScreen } from './screens/ExerciseListScreen';
import { CustomPlanEditorScreen } from './screens/CustomPlanEditorScreen';
import { LoadingSpinner } from './components/ui';

function SetupRequired() {
  return (
    <div className="setup-warning">
      <strong>Firebase not configured.</strong>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Firebase client
        keys. For auth API routes, set <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> in Vercel (or use{' '}
        <code>vercel dev</code> locally).
      </p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, firebaseReady } = useAuth();
  if (!firebaseReady) return <SetupRequired />;
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, firebaseReady } = useAuth();
  if (!firebaseReady) return <SetupRequired />;
  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/plans" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupScreen />
          </PublicRoute>
        }
      />
      <Route
        path="/plans"
        element={
          <ProtectedRoute>
            <PlanListScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans/:planId"
        element={
          <ProtectedRoute>
            <DayViewScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans/:planId/days/:dayId"
        element={
          <ProtectedRoute>
            <ExerciseListScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans/:planId/edit"
        element={
          <ProtectedRoute>
            <CustomPlanEditorScreen />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/plans" replace />} />
      <Route path="*" element={<Navigate to="/plans" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
