import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, Users, ClipboardList, LogOut, Ship, DollarSign, ArrowDownLeft, ArrowUpRight, Receipt, Building2 } from 'lucide-react';
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

const financeNavItems = [
  { to: '/financeiro', label: 'Dashboard', icon: DollarSign, end: true },
  { to: '/financeiro/receber', label: 'Contas a Receber', icon: ArrowDownLeft },
  { to: '/financeiro/pagar', label: 'Contas a Pagar', icon: ArrowUpRight },
  { to: '/financeiro/lancamentos', label: 'Lançamentos', icon: Receipt },
  { to: '/financeiro/fornecedores', label: 'Fornecedores', icon: Building2 },
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
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed top-0 left-0 h-full z-30 flex flex-col',
          'bg-[#1a2340] text-white transition-transform duration-200',
          'w-60',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-white/[0.06]">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center shrink-0">
            <Ship size={14} className="text-[#1a2340]" />
          </div>
          <span className="font-bold text-[15px] text-white/90 tracking-tight">
            usi<span className="text-accent">port</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin">
          <ul className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-[15px] font-medium',
                      'transition-colors duration-100',
                      isActive
                        ? 'bg-white/[0.1] text-white'
                        : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80',
                    ].join(' ')
                  }
                >
                  <Icon size={16} strokeWidth={1.8} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Financial Module - Admin Only */}
          {user?.role === 'admin' && (
            <>
              <div className="mt-4 mb-1.5 px-3">
                <p className="text-[12px] font-bold text-accent uppercase tracking-widest">Financeiro</p>
              </div>
              <div className="h-px bg-white/[0.06] mx-3 mb-1.5" />
              <ul className="space-y-0.5">
                {financeNavItems.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-2.5 px-3 py-2 rounded-md text-[15px] font-medium',
                          'transition-colors duration-100',
                          isActive
                            ? 'bg-white/[0.1] text-white'
                            : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80',
                        ].join(' ')
                      }
                    >
                      <Icon size={16} strokeWidth={1.8} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          {user && (
            <div className="px-3 py-1.5 mb-1">
              <p className="text-[13px] text-white/30">Conectado como</p>
              <p className="text-[15px] font-medium text-white/70 truncate">
                {user.first_name} {user.last_name}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[15px] font-medium text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition-colors"
          >
            <LogOut size={15} strokeWidth={1.8} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
