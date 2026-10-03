import { useEffect } from 'react';
import AuthLayout from './components/auth/AuthLayout';
import PageShell from './components/layout/PageShell';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ClientHome from './pages/ClientHome';
import WorkerHome from './pages/WorkerHome';
import SearchDirectory from './pages/SearchDirectory';
import WorkerProfile from './pages/WorkerProfile';
import PublicWorkerProfile from './pages/PublicWorkerProfile';
import ClientDashboard from './pages/ClientDashboard';
import WorkerInbox from './pages/WorkerInbox';
import ChatInbox from './pages/ChatInbox';
import ChatThread from './pages/ChatThread';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminCategories from './pages/AdminCategories';
import AdminZones from './pages/AdminZones';
import AdminDpi from './pages/AdminDpi';
import AdminReports from './pages/AdminReports';
import { Router, matchPath, useNavigate, usePath } from './router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ModeProvider, useMode } from './mode/ModeContext';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password']);
const PUBLIC_WORKER_PATTERN = '/workers/:id';
const CHAT_THREAD_PATTERN = '/chat/:id';
const LEGACY_CHAT_PATTERN = '/solicitudes/:id/chat';
const CATEGORY_PATTERN = '/categoria/:id';

function AuthenticatedApp() {
  const path = usePath();
  const { isClient, isWorker } = useMode();
  const chatThread = matchPath(CHAT_THREAD_PATTERN, path);
  const legacyChat = matchPath(LEGACY_CHAT_PATTERN, path);
  const categoryParams = matchPath(CATEGORY_PATTERN, path);

  if (path === '/mis-solicitudes' || path === '/client/requests') return <ClientDashboard />;
  if (path === '/trabajador/bandeja' || path === '/worker/requests') return <WorkerInbox />;
  if (path === '/worker/profile') return <WorkerProfile />;
  if (path === '/chat') return <ChatInbox />;
  if (chatThread) return <ChatThread />;
  if (legacyChat) return null; // AppRoutes redirige a /chat/:id
  if (path === '/admin') return <AdminDashboard />;
  if (path === '/admin/usuarios') return <AdminUsers />;
  if (path === '/admin/categorias') return <AdminCategories />;
  if (path === '/admin/zonas') return <AdminZones />;
  if (path === '/admin/dpi') return <AdminDpi />;
  if (path === '/admin/reportes' || path === '/admin/reports') return <AdminReports />;
  if (path === '/buscar' || categoryParams) return <SearchDirectory />;

  if (isWorker) return <WorkerHome />;
  return <ClientHome />;
}

function AppRoutes() {
  const path = usePath();
  const navigate = useNavigate();
  const { ready, isAuthenticated } = useAuth();
  const { mode, setMode } = useMode();
  const publicWorkerParams = matchPath(PUBLIC_WORKER_PATTERN, path);
  const legacyChat = matchPath(LEGACY_CHAT_PATTERN, path);

  useEffect(() => {
    if (!ready) return;
    if (publicWorkerParams) return;

    // Compatibilidad: /solicitudes/:id/chat → /chat/:id
    if (isAuthenticated && legacyChat) {
      navigate(`/chat/${legacyChat.id}`, { replace: true });
      return;
    }

    if (isAuthenticated && AUTH_PATHS.has(path)) {
      navigate('/', { replace: true });
      return;
    }

    if (!isAuthenticated && !AUTH_PATHS.has(path)) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, legacyChat, navigate, path, publicWorkerParams, ready]);

  if (!ready) {
    return <div style={{ minHeight: '100vh', background: '#ffffff' }} />;
  }

  if (publicWorkerParams) {
    return (
      <PageShell mode={mode} onModeChange={setMode}>
        <PublicWorkerProfile workerId={publicWorkerParams.id} />
      </PageShell>
    );
  }

  if (isAuthenticated && !AUTH_PATHS.has(path)) {
    return <AuthenticatedApp />;
  }

  const content =
    path === '/register' ? (
      <Register mode={mode} />
    ) : path === '/forgot-password' ? (
      <ForgotPassword />
    ) : path === '/reset-password' ? (
      <ResetPassword />
    ) : (
      <Login />
    );

  return (
    <AuthLayout mode={mode} onModeChange={setMode}>
      {content}
    </AuthLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ModeProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ModeProvider>
    </AuthProvider>
  );
}
