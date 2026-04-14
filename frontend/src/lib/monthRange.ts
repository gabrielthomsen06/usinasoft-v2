export function getMonthRange(mes: number, ano: number): { inicio: string; fim: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${pad(mes)}-01`,
    fim: `${ano}-${pad(mes)}-${pad(ultimoDia)}`,
  };
}

export function getCurrentMonth(): { mes: number; ano: number } {
  const hoje = new Date();
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
}

export function shiftMonth(mes: number, ano: number, delta: number): { mes: number; ano: number } {
  const idx = (mes - 1) + delta;
  const novoAno = ano + Math.floor(idx / 12);
  const novoMes = ((idx % 12) + 12) % 12 + 1;
  return { mes: novoMes, ano: novoAno };
}

export function formatMonthLabel(mes: number, ano: number): string {
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[mes - 1]} / ${ano}`;
}
