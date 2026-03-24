import { useEffect, useState } from 'react';
import { Wrench, Users, ClipboardList, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { pecasService } from '../services/pecas';
import { clientesService } from '../services/clientes';
import { opsService } from '../services/ops';
import { Peca, OrdemProducao } from '../types';

interface Stats {
  totalPecas: number;
  pecasConcluidas: number;
  opsAbertas: number;
  totalClientes: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalPecas: 0,
    pecasConcluidas: 0,
    opsAbertas: 0,
    totalClientes: 0,
  });
  const [recentPecas, setRecentPecas] = useState<Peca[]>([]);
  const [recentOps, setRecentOps] = useState<OrdemProducao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      pecasService.list(),
      clientesService.list(),
      opsService.list(),
    ])
      .then(([pecas, clientes, ops]) => {
        setStats({
          totalPecas: pecas.length,
          pecasConcluidas: pecas.filter((p) => p.status === 'concluida').length,
          opsAbertas: ops.filter((o) => o.status === 'aberta' || o.status === 'em_andamento').length,
          totalClientes: clientes.length,
        });
        setRecentPecas(pecas.slice(0, 5));
        setRecentOps(ops.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  const completionRate = stats.totalPecas > 0
    ? Math.round((stats.pecasConcluidas / stats.totalPecas) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Peças', value: stats.totalPecas, icon: Wrench },
          { label: 'Concluídas', value: stats.pecasConcluidas, icon: CheckCircle2 },
          { label: 'OPs abertas', value: stats.opsAbertas, icon: ClipboardList },
          { label: 'Clientes', value: stats.totalClientes, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-200/60 rounded-lg px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <Icon size={15} className="text-gray-400" strokeWidth={1.8} />
            </div>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Completion bar */}
      {stats.totalPecas > 0 && (
        <div className="bg-white border border-gray-200/60 rounded-lg px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-gray-600">Conclusão de peças</span>
            <span className="text-[13px] font-medium text-gray-900 tabular-nums">{completionRate}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {stats.pecasConcluidas} de {stats.totalPecas}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent pecas */}
        <div className="bg-white border border-gray-200/60 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Peças recentes</h3>
          </div>
          {recentPecas.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-gray-400">
              Nenhuma peça cadastrada
            </p>
          ) : (
            <ul>
              {recentPecas.map((peca, i) => (
                <li
                  key={peca.id}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    i < recentPecas.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 truncate">{peca.codigo}</p>
                    <p className="text-[11px] text-gray-400 truncate">{peca.descricao}</p>
                  </div>
                  <Badge status={peca.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent OPs */}
        <div className="bg-white border border-gray-200/60 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">OPs recentes</h3>
          </div>
          {recentOps.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-gray-400">
              Nenhuma OP cadastrada
            </p>
          ) : (
            <ul>
              {recentOps.map((op, i) => (
                <li
                  key={op.id}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    i < recentOps.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock size={13} className="text-gray-300 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-900">{op.codigo}</p>
                      <p className="text-[11px] text-gray-400">
                        {op.pecas_concluidas}/{op.total_pecas} peças
                      </p>
                    </div>
                  </div>
                  <Badge status={op.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
