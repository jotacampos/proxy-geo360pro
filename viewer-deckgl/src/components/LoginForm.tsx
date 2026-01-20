import { useState, FormEvent } from 'react';
import { useStore } from '../store';

export default function LoginForm() {
  const { login } = useStore();
  const [email, setEmail] = useState('suporte@geo360.com.br');
  const [password, setPassword] = useState('123456Geo!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-secondary p-10 rounded-xl w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-primary mb-8">
          Geo360 Editor
        </h1>

        {error && (
          <div className="bg-danger text-white px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-primary text-dark font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          deck.gl + editable-layers
        </p>
      </div>
    </div>
  );
}
