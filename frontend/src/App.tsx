import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Pecas } from './pages/Pecas';
import { Clientes } from './pages/Clientes';
import { Ops } from './pages/Ops';
import { DashboardFinanceiro } from './pages/DashboardFinanceiro';
import { ContasReceber } from './pages/ContasReceber';
import { ContasPagar } from './pages/ContasPagar';
import { Lancamentos } from './pages/Lancamentos';
import { Fornecedores } from './pages/Fornecedores';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="pecas" element={<Pecas />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="ops" element={<Ops />} />
              <Route path="financeiro" element={<DashboardFinanceiro />} />
              <Route path="financeiro/receber" element={<ContasReceber />} />
              <Route path="financeiro/pagar" element={<ContasPagar />} />
              <Route path="financeiro/lancamentos" element={<Lancamentos />} />
              <Route path="financeiro/fornecedores" element={<Fornecedores />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
