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
import MyWorkerProfile from './pages/MyWorkerProfile';
import WorkerContent from './pages/WorkerContent';
import WorkerOnlyNotice from './pages/WorkerOnlyNotice';
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
import AdminSuggestions from './pages/AdminSuggestions';
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';
import { Router, matchPath, useNavigate, usePath } from './router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ModeProvider, useMode } from './mode/ModeContext';
import { isAdminUser } from './lib/admin';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/admin/login', '/admin/register']);
const ADMIN_LOGIN = '/admin/login';
const RETURN_PATH_KEY = 'oficiosya.next';

function safeReturnPath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}
const PUBLIC_WORKER_PATTERN = '/workers/:id';
const CHAT_THREAD_PATTERN = '/chat/:id';
const LEGACY_CHAT_PATTERN = '/solicitudes/:id/chat';
const CATEGORY_PATTERN = '/categoria/:id';

function hasWorkerProfile(session) {
  return Boolean(session?.tienePerfilTrabajador || session?.perfilTrabajador);
}

function WorkerRoute({ children }) {
  const { session } = useAuth();
  const { isWorker, setMode } = useMode();
  const knownWorker = hasWorkerProfile(session);

  useEffect(() => {
    if (knownWorker && !isWorker) setMode('worker');
  }, [knownWorker, isWorker, setMode]);

  if (!isWorker && !knownWorker) return <WorkerOnlyNotice />;
  return children;
}

function AuthenticatedApp() {
  const path = usePath();
  const { isWorker } = useMode();
  const { isAdmin, user } = useAuth();
  const chatThread = matchPath(CHAT_THREAD_PATTERN, path);
  const legacyChat = matchPath(LEGACY_CHAT_PATTERN, path);
  const categoryParams = matchPath(CATEGORY_PATTERN, path);
  const admin = isAdmin || isAdminUser(user);

  if (path === '/mis-solicitudes' || path === '/client/requests') return <ClientDashboard />;
  if (path === '/trabajador/bandeja' || path === '/worker/requests') {
    return (
      <WorkerRoute>
        <WorkerInbox />
      </WorkerRoute>
    );
  }
  if (path === '/worker/profile') {
    return (
      <WorkerRoute>
        <WorkerProfile />
      </WorkerRoute>
    );
  }
  if (path === '/worker/my-profile') {
    return (
      <WorkerRoute>
        <MyWorkerProfile />
      </WorkerRoute>
    );
  }
  if (path === '/worker/content') {
    return (
      <WorkerRoute>
        <WorkerContent />
      </WorkerRoute>
    );
  }
  if (path === '/chat') return <ChatInbox />;
  if (chatThread) return <ChatThread />;
  if (legacyChat) return null; // AppRoutes redirige a /chat/:id
  if (path === '/admin') return <AdminDashboard />;
  if (path === '/admin/usuarios') return <AdminUsers />;
  if (path === '/admin/sugerencias') return <AdminSuggestions />;
  if (path === '/admin/categorias') return <AdminCategories />;
  if (path === '/admin/zonas') return <AdminZones />;
  if (path === '/admin/dpi') return <AdminDpi />;
  if (path === '/admin/reportes' || path === '/admin/reports') return <AdminReports />;
  if (path === '/buscar' || categoryParams) return <SearchDirectory />;

  if (admin) return <AdminDashboard />;
  if (isWorker) return <WorkerHome />;
  return <ClientHome />;
}

function isAdminPath(path) {
  return path === '/admin' || path.startsWith('/admin/');
}

function AppRoutes() {
  const path = usePath();
  const navigate = useNavigate();
  const { ready, isAuthenticated, isAdmin, user } = useAuth();
  const { mode, setMode } = useMode();
  const publicWorkerParams = matchPath(PUBLIC_WORKER_PATTERN, path);
  const legacyChat = matchPath(LEGACY_CHAT_PATTERN, path);
  const admin = isAdmin || isAdminUser(user);

  useEffect(() => {
    if (!ready) return;
    if (publicWorkerParams) return;

    // Compatibilidad: /solicitudes/:id/chat → /chat/:id
    if (isAuthenticated && legacyChat) {
      navigate(`/chat/${legacyChat.id}`, { replace: true });
      return;
    }

    if (!isAuthenticated && isAdminPath(path) && path !== ADMIN_LOGIN && path !== '/admin/register') {
      navigate(ADMIN_LOGIN, { replace: true });
      return;
    }

    if (isAuthenticated && admin) {
      if (AUTH_PATHS.has(path) || !isAdminPath(path)) {
        sessionStorage.removeItem(RETURN_PATH_KEY);
        navigate('/admin', { replace: true });
      }
      return;
    }

    if (isAuthenticated && isAdminPath(path)) {
      navigate('/', { replace: true });
      return;
    }

    if (isAuthenticated && AUTH_PATHS.has(path)) {
      const next = safeReturnPath(sessionStorage.getItem(RETURN_PATH_KEY));
      sessionStorage.removeItem(RETURN_PATH_KEY);
      navigate(next === ADMIN_LOGIN ? '/' : next, { replace: true });
      return;
    }

    if (!isAuthenticated && !AUTH_PATHS.has(path)) {
      sessionStorage.setItem(RETURN_PATH_KEY, `${path}${window.location.search || ''}`);
      navigate('/login', { replace: true });
    }
  }, [admin, isAuthenticated, legacyChat, navigate, path, publicWorkerParams, ready]);

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

  if (path === ADMIN_LOGIN || path === '/admin/register') {
    return (
      <AuthLayout mode="admin" hideMode>
        {path === ADMIN_LOGIN ? <AdminLogin /> : <AdminRegister />}
      </AuthLayout>
    );
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
