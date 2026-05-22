import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import { LoadingState } from './components/StatusPanel';
import { CloudIQProvider } from './context/CloudIQContext';

const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Assistant       = lazy(() => import('./pages/Assistant'));
const Insights        = lazy(() => import('./pages/Insights'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const Activity        = lazy(() => import('./pages/Activity'));
const GraphView       = lazy(() => import('./pages/GraphView'));
const Globe           = lazy(() => import('./pages/Globe'));
const Resources       = lazy(() => import('./pages/Resources'));
const Predictions     = lazy(() => import('./pages/Predictions'));

// Fast, subtle, professional transitions (220ms)
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1, y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0, y: -6,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

function RouteLoader() {
  return <LoadingState message="Booting CloudIQ command modules..." />;
}

// FIXED: motion.div is the direct child of AnimatePresence with key={location.pathname}.
// Routes sits INSIDE motion.div. AnimatePresence can now properly coordinate exit/enter.
// Old bug: key was on <Routes> (not a motion component) so transitions never fired.
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ minHeight: '100%', width: '100%' }}
      >
        <Routes location={location}>
          <Route path="/"            element={<ErrorBoundary routeKey={location.pathname}><Dashboard /></ErrorBoundary>} />
          <Route path="/assistant"   element={<ErrorBoundary routeKey={location.pathname}><Assistant /></ErrorBoundary>} />
          <Route path="/insights"    element={<ErrorBoundary routeKey={location.pathname}><Insights /></ErrorBoundary>} />
          <Route path="/actions"     element={<ErrorBoundary routeKey={location.pathname}><Recommendations /></ErrorBoundary>} />
          <Route path="/activity"    element={<ErrorBoundary routeKey={location.pathname}><Activity /></ErrorBoundary>} />
          <Route path="/graph"       element={<ErrorBoundary routeKey={location.pathname}><GraphView /></ErrorBoundary>} />
          <Route path="/globe"       element={<ErrorBoundary routeKey={location.pathname}><Globe /></ErrorBoundary>} />
          <Route path="/resources"   element={<ErrorBoundary routeKey={location.pathname}><Resources /></ErrorBoundary>} />
          <Route path="/predictions" element={<ErrorBoundary routeKey={location.pathname}><Predictions /></ErrorBoundary>} />
          <Route path="/chatbot"         element={<Navigate to="/assistant" replace />} />
          <Route path="/cost-analysis"   element={<Navigate to="/insights" replace />} />
          <Route path="/recommendations" element={<Navigate to="/actions" replace />} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  useEffect(() => {
    // Restore AI-driven UI overrides persisted in localStorage
    try {
      const overrides = JSON.parse(localStorage.getItem('cloudiq-ui-overrides') || '{}');
      const root = document.documentElement;
      Object.entries(overrides).forEach(([key, value]) => {
        if (key === '--theme') {
          if (value === 'dark') {
            root.classList.add('dark');
            root.setAttribute('data-theme', 'dark');
          } else {
            root.classList.remove('dark');
            root.setAttribute('data-theme', 'light');
          }
        } else if (key === '--font-size-base') {
          root.style.fontSize = value;
        } else if (key === '--font-family') {
          document.body.style.fontFamily = value;
        } else {
          root.style.setProperty(key, value);
        }
      });
    } catch (err) {
      console.warn('Failed to restore UI overrides:', err);
    }
  }, []);

  return (
    <Router>
      <ErrorBoundary>
        <CloudIQProvider>
          <AppShell>
            <Suspense fallback={<RouteLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </AppShell>
        </CloudIQProvider>
      </ErrorBoundary>
    </Router>
  );
}
