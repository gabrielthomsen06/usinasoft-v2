import { Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '??';

  return (
    <header className="h-14 bg-white border-b border-gray-200/60 flex items-center justify-between px-4 lg:px-6 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors lg:hidden"
        aria-label="Menu"
      >
        <Menu size={18} />
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="w-7 h-7 bg-[#1a2340] rounded-full flex items-center justify-center text-white text-[12px] font-semibold select-none">
          {initials}
        </div>
        <span className="text-[15px] font-medium text-gray-700 hidden sm:block">
          {user ? `${user.first_name} ${user.last_name}` : ''}
        </span>
      </div>
    </header>
  );
}
