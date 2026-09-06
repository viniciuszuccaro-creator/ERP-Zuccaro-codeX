import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/lib/ErrorBoundary';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const blockedMessages = {
    user_not_registered: {
      title: 'Acesso restrito',
      message: 'Você não está registrado neste aplicativo. Solicite acesso ao administrador.',
    },
    account_inactive: {
      title: 'Usuário inativo',
      message: 'Esta conta está inativa ou desligada. O acesso interno foi bloqueado.',
    },
    account_disabled: {
      title: 'Usuário desativado',
      message: 'Esta conta está desativada. O acesso interno foi bloqueado.',
    },
    missing_group: {
      title: 'Grupo obrigatório',
      message: 'O perfil não possui grupo. Sem contexto de grupo o ERP não libera dados internos.',
    },
    missing_company: {
      title: 'Empresa obrigatória',
      message: 'O perfil não possui empresa. Sem empresa autorizada o ERP não libera dados internos.',
    },
  };

  if (!isAuthenticated) {
    const blocked = blockedMessages[authError?.type];
    if (blocked) {
      return <UserNotRegisteredError title={blocked.title} message={blocked.message} />;
    }
    if (authError?.type === 'auth_required' || !authError) {
      navigateToLogin();
    }
    return (
      <UserNotRegisteredError
        title="Sessão inválida"
        message="Faça login novamente. Usuário não autenticado não acessa dados internos."
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ErrorBoundary>
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
        </ErrorBoundary>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
