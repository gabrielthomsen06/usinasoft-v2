import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel, getCurrentMonth, shiftMonth } from '../../lib/monthRange';

interface MonthNavigatorProps {
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

export function MonthNavigator({ mes, ano, onChange }: MonthNavigatorProps) {
  const hoje = getCurrentMonth();
  const isAtual = mes === hoje.mes && ano === hoje.ano;

  const prev = () => { const r = shiftMonth(mes, ano, -1); onChange(r.mes, r.ano); };
  const next = () => { const r = shiftMonth(mes, ano, 1); onChange(r.mes, r.ano); };
  const hojeClick = () => onChange(hoje.mes, hoje.ano);

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-gray-200/60 rounded-md">
      <button onClick={prev} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-l-md transition-colors" aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </button>
      <span className="px-3 py-2 text-[15px] font-semibold text-gray-700 min-w-[140px] text-center">
        {formatMonthLabel(mes, ano)}
      </span>
      <button onClick={next} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors" aria-label="Próximo mês">
        <ChevronRight size={16} />
      </button>
      {!isAtual && (
        <button onClick={hojeClick} className="px-3 py-2 text-[13px] font-medium text-[#1a2340] hover:bg-gray-50 rounded-r-md border-l border-gray-200/60 transition-colors">
          Hoje
        </button>
      )}
    </div>
  );
}
