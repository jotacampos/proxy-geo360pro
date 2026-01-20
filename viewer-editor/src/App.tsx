import { useStore } from './store';
import LoginForm from './components/LoginForm';
import OrgSelector from './components/OrgSelector';
import { AppLayout } from './components/layout/AppLayout';
import { FlexLayoutTest } from './pages/FlexLayoutTest';

// Simple URL-based routing for test pages
function useTestPage(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('test');
}

function App() {
  const { view, loading, error, setError } = useStore();
  const testPage = useTestPage();

  // If test page is requested, render it directly
  if (testPage === 'flexlayout') {
    return <FlexLayoutTest />;
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-danger text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-white/80 hover:text-white text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Views */}
      {view === 'login' && <LoginForm />}
      {view === 'org-select' && <OrgSelector />}
      {view === 'map' && <AppLayout />}

      {/* Dev link to test page */}
      {view === 'login' && (
        <div className="fixed bottom-4 left-4 text-xs text-gray-500">
          <a
            href="?test=flexlayout"
            className="hover:text-emerald-400 underline"
          >
            FlexLayout Test →
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
