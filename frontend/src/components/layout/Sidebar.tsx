import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, Users, ClipboardList, LogOut, Cog } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pecas', label: 'Peças', icon: Wrench },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/ops', label: 'Ordens de Produção', icon: ClipboardList },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed top-0 left-0 h-full z-30 flex flex-col',
          'bg-secondary text-white transition-transform duration-300 ease-in-out',
          'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Cog size={20} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-lg leading-tight text-white">
              Usina<span className="text-primary">Soft</span>
            </span>
            <p className="text-xs text-gray-400 leading-tight">v2.0</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                      'transition-colors duration-150',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white',
                    ].join(' ')
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-gray-400">Conectado como</p>
              <p className="text-sm font-medium text-white truncate">
                {user.first_name} {user.last_name}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
