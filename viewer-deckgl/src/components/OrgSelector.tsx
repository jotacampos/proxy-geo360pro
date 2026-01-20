import { useStore } from '../store';

export default function OrgSelector() {
  const { organizations, selectOrg, logout } = useStore();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-secondary p-10 rounded-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold text-center text-primary mb-8">
          Selecione a Organização
        </h2>

        {organizations.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>Nenhuma organização encontrada.</p>
            <p className="text-sm mt-2">
              Verifique suas permissões de acesso.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {organizations.map((org) => (
              <li
                key={org.id}
                onClick={() => selectOrg(org.id)}
                className="p-4 bg-dark rounded-lg cursor-pointer border-2 border-transparent hover:border-primary hover:bg-dark/80 transition-all"
              >
                <div className="font-semibold text-lg">{org.name}</div>
                <div className="text-gray-500 text-sm font-mono mt-1">
                  {org.id}
                </div>
                <div className="text-gray-600 text-xs mt-1">
                  Schema: {org.schema}
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={logout}
          className="w-full mt-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
