import { useEffect, useState } from 'react';
import { Wrench, Users, ClipboardList, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { Card } from '../components/ui/Card';
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

  const statCards = [
    {
      label: 'Total de Peças',
      value: stats.totalPecas,
      icon: Wrench,
      color: 'text-primary',
      bg: 'bg-orange-50',
    },
    {
      label: 'Peças Concluídas',
      value: stats.pecasConcluidas,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'OPs em Aberto',
      value: stats.opsAbertas,
      icon: ClipboardList,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Clientes',
      value: stats.totalClientes,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral da produção</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg} shrink-0`}>
              <Icon size={24} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Completion rate */}
      {stats.totalPecas > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              <span className="font-medium text-secondary text-sm">Taxa de Conclusão de Peças</span>
            </div>
            <span className="text-sm font-semibold text-secondary">
              {Math.round((stats.pecasConcluidas / stats.totalPecas) * 100)}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(stats.pecasConcluidas / stats.totalPecas) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {stats.pecasConcluidas} de {stats.totalPecas} peças concluídas
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent pecas */}
        <Card title="Peças Recentes" padding={false}>
          {recentPecas.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Nenhuma peça cadastrada
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentPecas.map((peca) => (
                <li key={peca.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-secondary">{peca.codigo}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[180px]">{peca.descricao}</p>
                  </div>
                  <Badge status={peca.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent OPs */}
        <Card title="Ordens de Produção Recentes" padding={false}>
          {recentOps.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Nenhuma OP cadastrada
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentOps.map((op) => (
                <li key={op.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary">{op.codigo}</p>
                      <p className="text-xs text-gray-400">
                        {op.pecas_concluidas}/{op.total_pecas} peças
                      </p>
                    </div>
                  </div>
                  <Badge status={op.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
