import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { Cog, Lock, Mail, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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
      toast('error', 'E-mail ou senha inválidos. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-secondary to-gray-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Cog size={22} className="text-white" />
          </div>
          <span className="font-bold text-2xl text-white">
            Usina<span className="text-primary">Soft</span>
          </span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestão de<br />
            <span className="text-primary">Produção</span><br />
            Simplificada
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed max-w-md">
            Controle suas peças, clientes e ordens de produção em um único lugar. Eficiência e rastreabilidade para sua usinagem.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: Zap, text: 'Controle em tempo real das peças' },
              { icon: Cog, text: 'Gestão completa de ordens de produção' },
              { icon: Lock, text: 'Acesso seguro e multi-usuário' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-primary" />
                </div>
                <span className="text-gray-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-500 text-sm relative z-10">
          © {new Date().getFullYear()} UsinaSoft v2.0 — Todos os direitos reservados
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Cog size={22} className="text-white" />
            </div>
            <span className="font-bold text-2xl text-secondary">
              Usina<span className="text-primary">Soft</span>
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-secondary">Bem-vindo de volta</h1>
              <p className="text-gray-500 mt-1 text-sm">Entre com suas credenciais para continuar</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="relative">
                <div className="absolute left-3 top-[2.35rem] text-gray-400 pointer-events-none">
                  <Mail size={16} />
                </div>
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  error={errors.email?.message}
                  className="pl-9"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-[2.35rem] text-gray-400 pointer-events-none">
                  <Lock size={16} />
                </div>
                <Input
                  label="Senha"
                  type="password"
                  placeholder="••••••••"
                  required
                  error={errors.password?.message}
                  className="pl-9"
                  autoComplete="current-password"
                  {...register('password')}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                className="w-full mt-2"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
