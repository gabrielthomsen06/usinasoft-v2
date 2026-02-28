import { Peca, OrdemProducao } from '../../types';

type PecaStatus = Peca['status'];
type OPStatus = OrdemProducao['status'];
type StatusValue = PecaStatus | OPStatus;

interface BadgeProps {
  status: StatusValue;
}

const statusConfig: Record<StatusValue, { label: string; className: string }> = {
  em_fila: {
    label: 'Em Fila',
    className: 'bg-gray-100 text-gray-700',
  },
  em_andamento: {
    label: 'Em Andamento',
    className: 'bg-blue-100 text-blue-700',
  },
  pausada: {
    label: 'Pausada',
    className: 'bg-yellow-100 text-yellow-700',
  },
  concluida: {
    label: 'Concluída',
    className: 'bg-green-100 text-green-700',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'bg-red-100 text-red-700',
  },
  aberta: {
    label: 'Aberta',
    className: 'bg-gray-100 text-gray-700',
  },
};

export function Badge({ status }: BadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
      ].join(' ')}
    >
      {config.label}
    </span>
  );
}
