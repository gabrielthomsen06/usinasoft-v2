import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, ArrowDownLeft, ArrowUpRight, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { dashboardFinanceiroService } from '../services/dashboardFinanceiro';
import { DashboardFinanceiro as DashboardData } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const categoriaConfig: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  material: { label: 'Material', color: 'text-blue-700', bg: 'bg-blue-50', bar: 'bg-blue-500' },
  servicos: { label: 'Serviços', color: 'text-purple-700', bg: 'bg-purple-50', bar: 'bg-purple-500' },
  fixas: { label: 'Fixas', color: 'text-gray-600', bg: 'bg-gray-100', bar: 'bg-gray-500' },
  impostos: { label: 'Impostos', color: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-500' },
  carro: { label: 'Carro', color: 'text-sky-700', bg: 'bg-sky-50', bar: 'bg-sky-500' },
  gasolina: { label: 'Gasolina', color: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  salario: { label: 'Salário', color: 'text-teal-700', bg: 'bg-teal-50', bar: 'bg-teal-500' },
  aluguel: { label: 'Aluguel', color: 'text-indigo-700', bg: 'bg-indigo-50', bar: 'bg-indigo-500' },
  patrimonio: { label: 'Patrimônio', color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500' },
  outros: { label: 'Outros', color: 'text-gray-500', bg: 'bg-gray-50', bar: 'bg-gray-400' },
};

export function DashboardFinanceiro() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await dashboardFinanceiroService.getData({ mes, ano });
      setData(result);
    } catch {
      toast('error', 'Erro ao carregar dashboard financeiro');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [mes, ano]);

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAno(ano - 1); }
    else setMes(mes - 1);
  };
  const nextMonth = () => {
    if (mes === 12) { setMes(1); setAno(ano + 1); }
    else setMes(mes + 1);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await dashboardFinanceiroService.exportar({ mes, ano });
      toast('success', 'Planilha exportada!');
    } catch {
      toast('error', 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    { label: 'Receita do Mês', value: data.total_recebido_mes, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-500' },
    { label: 'Despesas do Mês', value: data.total_pago_mes, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50', border: 'border-l-red-500' },
    { label: 'Lucro Líquido', value: data.lucro_liquido, icon: DollarSign, color: data.lucro_liquido >= 0 ? 'text-blue-600' : 'text-red-600', bg: data.lucro_liquido >= 0 ? 'bg-blue-50' : 'bg-red-50', border: data.lucro_liquido >= 0 ? 'border-l-blue-500' : 'border-l-red-500' },
    { label: 'Contas em Atraso', value: data.contas_vencidas_valor, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-l-amber-500', extra: `${data.contas_vencidas_count} contas` },
  ];

  // Chart data
  const allMonths = new Set<string>();
  data.receitas_por_mes.forEach((r) => allMonths.add(`${r.ano}-${String(r.mes).padStart(2, '0')}`));
  data.despesas_por_mes.forEach((d) => allMonths.add(`${d.ano}-${String(d.mes).padStart(2, '0')}`));
  const sortedMonths = Array.from(allMonths).sort();

  const chartData = sortedMonths.map((key) => {
    const [a, m] = key.split('-').map(Number);
    const rec = data.receitas_por_mes.find((r) => r.ano === a && r.mes === m);
    const desp = data.despesas_por_mes.find((d) => d.ano === a && d.mes === m);
    return { label: `${MONTHS[m - 1]}/${String(a).slice(2)}`, receita: rec?.total ?? 0, despesa: desp?.total ?? 0 };
  });

  const maxChartVal = Math.max(...chartData.map((d) => Math.max(d.receita, d.despesa)), 1);

  // Gastos por categoria
  const maxCatVal = Math.max(...(data.gastos_por_categoria?.map((g) => g.total) || []), 1);
  const totalGastos = data.gastos_por_categoria?.reduce((s, g) => s + g.total, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header com filtro de mês e botão exportar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard Financeiro</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">Visão geral das finanças</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-200/60 rounded-lg px-1 py-1">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-50 rounded transition-colors">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="text-[15px] font-semibold text-gray-900 min-w-[140px] text-center">
              {MONTHS_FULL[mes - 1]} {ano}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-50 rounded transition-colors">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2.5 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className={`bg-white border border-gray-200/60 rounded-lg p-4 border-l-4 ${card.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg}`}>
                <card.icon size={16} className={card.color} />
              </div>
              <p className="text-[13px] text-gray-400 font-medium">{card.label}</p>
            </div>
            <p className={`text-[22px] font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
            {card.extra && <p className="text-[13px] text-amber-600 font-medium mt-0.5">{card.extra}</p>}
          </div>
        ))}
      </div>

      {/* Receitas vs Despesas — gráfico com largura máxima por barra */}
      <div className="bg-white border border-gray-200/60 rounded-lg p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[16px] font-semibold text-gray-900">Receitas vs Despesas</p>
            <p className="text-[13px] text-gray-400">Últimos meses</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-[13px] text-gray-400">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-400" />
              <span className="text-[13px] text-gray-400">Despesas</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-52 text-[15px] text-gray-400">Sem dados para exibir</div>
        ) : (
          <div className="flex items-end justify-center gap-6 h-52">
            {chartData.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5" style={{ width: '60px' }}>
                <div className="flex gap-1 items-end w-full h-44">
                  <div
                    className="flex-1 bg-blue-500 rounded-t transition-all max-w-[24px] mx-auto"
                    style={{ height: `${Math.max((d.receita / maxChartVal) * 100, d.receita > 0 ? 3 : 0)}%` }}
                    title={`Receita: ${formatCurrency(d.receita)}`}
                  />
                  <div
                    className="flex-1 bg-red-400 rounded-t transition-all max-w-[24px] mx-auto"
                    style={{ height: `${Math.max((d.despesa / maxChartVal) * 100, d.despesa > 0 ? 3 : 0)}%` }}
                    title={`Despesa: ${formatCurrency(d.despesa)}`}
                  />
                </div>
                <span className="text-[12px] text-gray-500 font-medium">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Duas colunas: Gastos por Categoria + Últimas Movimentações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gastos por Categoria */}
        <div className="bg-white border border-gray-200/60 rounded-lg">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[16px] font-semibold text-gray-900">Gastos por Categoria</p>
              <p className="text-[13px] text-gray-400">{MONTHS_FULL[mes - 1]} {ano}</p>
            </div>
            {totalGastos > 0 && (
              <p className="text-[16px] font-bold text-gray-900">{formatCurrency(totalGastos)}</p>
            )}
          </div>
          <div className="p-5">
            {(!data.gastos_por_categoria || data.gastos_por_categoria.length === 0) ? (
              <div className="flex items-center justify-center h-52 text-[15px] text-gray-400">Nenhum gasto no período</div>
            ) : (
              <div className="space-y-3.5">
                {data.gastos_por_categoria.map((g) => {
                  const config = categoriaConfig[g.categoria] || categoriaConfig.outros;
                  const pct = totalGastos > 0 ? (g.total / totalGastos) * 100 : 0;
                  return (
                    <div key={g.categoria}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[13px] font-semibold ${config.color} ${config.bg}`}>
                            {config.label}
                          </span>
                          <span className="text-[13px] text-gray-400">{g.quantidade} {g.quantidade === 1 ? 'conta' : 'contas'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] text-gray-400">{pct.toFixed(1)}%</span>
                          <span className="text-[15px] font-semibold text-gray-900 min-w-[100px] text-right">{formatCurrency(g.total)}</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${config.bar}`}
                          style={{ width: `${(g.total / maxCatVal) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Últimas Movimentações */}
        <div className="bg-white border border-gray-200/60 rounded-lg">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[16px] font-semibold text-gray-900">Últimas Movimentações</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-gray-400">A Receber:</span>
                <span className="text-[14px] font-bold text-blue-600">{formatCurrency(data.total_a_receber)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-gray-400">A Pagar:</span>
                <span className="text-[14px] font-bold text-red-500">{formatCurrency(data.total_a_pagar)}</span>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.ultimas_transacoes.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-[15px] text-gray-400">Nenhuma movimentação</div>
            ) : (
              data.ultimas_transacoes.slice(0, 8).map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${l.tipo === 'receita' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {l.tipo === 'receita' ? <ArrowDownLeft size={15} className="text-emerald-600" /> : <ArrowUpRight size={15} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-gray-900 truncate">{l.descricao}</p>
                    <p className="text-[12px] text-gray-400">{new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className={`text-[14px] font-semibold whitespace-nowrap ${l.tipo === 'receita' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {l.tipo === 'receita' ? '+' : '-'} {formatCurrency(l.valor)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Contas em Atraso */}
      {data.contas_vencidas_list.length > 0 && (
        <div className="bg-white border border-gray-200/60 rounded-lg">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <p className="text-[16px] font-semibold text-gray-900">Contas em Atraso</p>
            <span className="ml-1 bg-red-50 text-red-600 text-[13px] font-bold px-2 py-0.5 rounded">{data.contas_vencidas_list.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Descrição</th>
                  <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Vencimento</th>
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {data.contas_vencidas_list.map((c, i) => {
                  const venc = new Date(c.data_vencimento + 'T00:00:00');
                  const diasAtraso = Math.floor((Date.now() - venc.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${i < data.contas_vencidas_list.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <td className="px-5 py-3 text-[15px] font-medium text-gray-900">{c.cliente?.nome ?? '—'}</td>
                      <td className="px-5 py-3 text-[15px] text-gray-500 max-w-[200px] truncate">{c.descricao}</td>
                      <td className="px-5 py-3 text-[15px] font-semibold text-gray-900 text-right">{formatCurrency(c.valor)}</td>
                      <td className="px-5 py-3 text-[15px] text-gray-500">{venc.toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[13px] font-semibold text-red-700 bg-red-50">{diasAtraso} dias</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
