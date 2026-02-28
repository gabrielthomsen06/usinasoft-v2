import React, { createContext, useCallback, useContext, useState } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const iconMap = {
  success: <CheckCircle size={18} className="text-green-500 shrink-0" />,
  error: <XCircle size={18} className="text-red-500 shrink-0" />,
  info: <Info size={18} className="text-blue-500 shrink-0" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-white border-l-4 border-green-500',
  error: 'bg-white border-l-4 border-red-500',
  info: 'bg-white border-l-4 border-blue-500',
};

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  return (
    <div
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[280px] max-w-sm',
        'animate-slide-in',
        bgMap[item.type],
      ].join(' ')}
    >
      {iconMap[item.type]}
      <span className="flex-1 text-sm text-secondary">{item.message}</span>
      <button
        onClick={() => onRemove(item.id)}
        className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), 3000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {ReactDOM.createPortal(
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onRemove={remove} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
