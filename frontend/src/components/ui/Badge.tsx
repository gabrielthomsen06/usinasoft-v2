import { Peca, OrdemProducao } from '../../types';

type PecaStatus = Peca['status'];
type OPStatus = OrdemProducao['status'];
type StatusValue = PecaStatus | OPStatus;

interface BadgeProps {
  status: StatusValue;
}

const statusConfig: Record<StatusValue, { label: string; dot: string; text: string }> = {
  em_fila: {
    label: 'Em Fila',
    dot: 'bg-gray-400',
    text: 'text-gray-600',
  },
  em_andamento: {
    label: 'Em Andamento',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
  },
  pausada: {
    label: 'Pausada',
    dot: 'bg-amber-400',
    text: 'text-amber-700',
  },
  concluida: {
    label: 'Concluída',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  cancelada: {
    label: 'Cancelada',
    dot: 'bg-red-400',
    text: 'text-red-600',
  },
  aberta: {
    label: 'Aberta',
    dot: 'bg-gray-400',
    text: 'text-gray-600',
  },
};

export function Badge({ status }: BadgeProps) {
  const config = statusConfig[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[14px] font-medium ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
