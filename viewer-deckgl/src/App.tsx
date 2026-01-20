import { useStore } from './store';
import LoginForm from './components/LoginForm';
import OrgSelector from './components/OrgSelector';
import MapView from './components/MapView';

function App() {
  const { view, loading, error, setError } = useStore();

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
      {view === 'map' && <MapView />}
    </div>
  );
}

export default App;
