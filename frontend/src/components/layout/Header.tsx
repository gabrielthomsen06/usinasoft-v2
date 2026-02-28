import { Menu, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { user } = useAuth();

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '??';

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-gray-500 hover:text-secondary hover:bg-gray-100 transition-colors lg:hidden"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
        {title && (
          <h1 className="text-lg font-semibold text-secondary hidden sm:block">{title}</h1>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          className="p-2 rounded-lg text-gray-500 hover:text-secondary hover:bg-gray-100 transition-colors relative"
          aria-label="Notificações"
        >
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-semibold select-none">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-secondary leading-tight">
              {user ? `${user.first_name} ${user.last_name}` : ''}
            </p>
            <p className="text-xs text-gray-400 leading-tight">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
