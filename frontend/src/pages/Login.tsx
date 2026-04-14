import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { Lock, Mail, Ship, Anchor, Shield, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/pecas" replace />;
  }

  const onSubmit = async ({ email, password }: FormValues) => {
    try {
      await login(email, password);
      toast('success', 'Login realizado com sucesso!');
      navigate('/pecas');
    } catch {
      toast('error', 'Usuário ou senha inválidos. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-primary via-primary-700 to-primary-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Geometric shapes */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-1/2 -left-20 w-72 h-72 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-white/3 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Wave pattern */}
          <svg className="absolute bottom-0 left-0 w-full opacity-[0.07]" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#E8A830" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </svg>
          <svg className="absolute bottom-0 left-0 w-full opacity-[0.04]" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#ffffff" d="M0,288L48,272C96,256,192,224,288,213.3C384,203,480,213,576,229.3C672,245,768,267,864,261.3C960,256,1056,224,1152,213.3C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </svg>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent-500 rounded-xl flex items-center justify-center shadow-lg shadow-accent/25 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Ship size={24} className="text-primary-900" />
          </div>
          <div>
            <span className="font-extrabold text-3xl text-white tracking-tight">
              LSC <span className="text-accent">Usinagem</span>
            </span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-accent/15 border border-accent/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <span className="text-accent text-[14px] font-semibold tracking-wide">Sistema de Gestão Industrial</span>
          </div>

          <h2 className="text-[3.25rem] font-extrabold text-white leading-[1.1] mb-6">
            Controle total
            <span className="block bg-gradient-to-r from-accent to-accent-300 bg-clip-text text-transparent mt-2">
              da sua produção.
            </span>
          </h2>
          <p className="text-primary-200/80 text-lg leading-relaxed max-w-md">
            Gerencie peças, clientes e ordens de produção em uma única plataforma. Eficiência e rastreabilidade para sua usinagem.
          </p>

          <div className="mt-12 space-y-3">
            {[
              { icon: BarChart3, title: 'Controle em tempo real', desc: 'Acompanhe todas as operações' },
              { icon: Anchor, title: 'Gestão completa', desc: 'Ordens de produção integradas' },
              { icon: Shield, title: 'Acesso seguro', desc: 'Multi-usuário com permissões' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group flex items-center gap-4 bg-white/[0.06] hover:bg-white/[0.1] backdrop-blur-sm border border-white/[0.08] hover:border-white/[0.15] rounded-xl px-5 py-4 transition-all duration-300 cursor-default"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-accent/25 to-accent/10 group-hover:from-accent/35 group-hover:to-accent/15 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300">
                  <Icon size={18} className="text-accent" />
                </div>
                <div>
                  <span className="text-white font-semibold text-sm">{title}</span>
                  <p className="text-primary-300/70 text-[14px] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-300/40 text-[14px] relative z-10">
          © {new Date().getFullYear()} LSC Usinagem — Todos os direitos reservados
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-primary-50/30" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <div className="w-11 h-11 bg-gradient-to-br from-accent to-accent-500 rounded-xl flex items-center justify-center">
              <Ship size={22} className="text-primary-900" />
            </div>
            <div>
              <span className="font-extrabold text-2xl text-primary tracking-tight">
                LSC <span className="text-accent">Usinagem</span>
              </span>
              </div>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(28,45,90,0.12)] border border-gray-100/80 p-10">
            <div className="mb-8">
              <h1 className="text-[1.65rem] font-bold text-primary tracking-tight">Bem-vindo de volta</h1>
              <p className="text-gray-400 mt-2 text-sm">Entre com suas credenciais para acessar o sistema</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email field */}
              <div>
                <label htmlFor="email" className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Usuário
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors duration-200 pointer-events-none">
                    <Mail size={16} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className={[
                      'w-full pl-10 pr-4 py-3 border rounded-xl text-sm text-secondary bg-gray-50/50',
                      'placeholder-gray-300 transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary focus:bg-white',
                      'hover:border-gray-300 hover:bg-white',
                      errors.email
                        ? 'border-red-300 focus:ring-red-500/10 focus:border-red-400'
                        : 'border-gray-200',
                    ].join(' ')}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-[14px] text-red-500 mt-1.5 ml-0.5">{errors.email.message}</p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Senha
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors duration-200 pointer-events-none">
                    <Lock size={16} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className={[
                      'w-full pl-10 pr-4 py-3 border rounded-xl text-sm text-secondary bg-gray-50/50',
                      'placeholder-gray-300 transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary focus:bg-white',
                      'hover:border-gray-300 hover:bg-white',
                      errors.password
                        ? 'border-red-300 focus:ring-red-500/10 focus:border-red-400'
                        : 'border-gray-200',
                    ].join(' ')}
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-[14px] text-red-500 mt-1.5 ml-0.5">{errors.password.message}</p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={[
                  'w-full flex items-center justify-center gap-2.5 py-3.5 px-6 mt-3 rounded-xl text-sm font-semibold',
                  'bg-gradient-to-r from-primary to-primary-600 text-white',
                  'hover:from-primary-600 hover:to-primary-700 hover:shadow-lg hover:shadow-primary/25',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2',
                  'active:scale-[0.98] transition-all duration-200',
                  'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100',
                ].join(' ')}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight size={16} className="ml-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Bottom text */}
          <p className="text-center text-[14px] text-gray-300 mt-8 lg:hidden">
            © {new Date().getFullYear()} LSC Usinagem — Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
