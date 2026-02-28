import { Users } from 'lucide-react';
import { Card } from '../components/ui/Card';

export function Clientes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary">Clientes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerenciamento de clientes</p>
      </div>
      <Card>
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center">
            <Users size={26} className="text-primary" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Módulo em desenvolvimento</p>
          <p className="text-gray-400 text-xs text-center max-w-xs">
            A funcionalidade de gerenciamento de clientes estará disponível em breve.
          </p>
        </div>
      </Card>
    </div>
  );
}
