// Regras puras da mensalidade (sem banco, sem rede). Datas sempre AAAA-MM-DD.
export const DIAS_TOLERANCIA = 5;

export const hojeBR = (agora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Mesmo dia no mes seguinte; se nao existir (31/01), usa o ultimo dia do mes. */
export function maisUmMes(data: string) {
  const [a, m, d] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimo), 12)).toISOString().slice(0, 10);
}

export const diasDeAtraso = (vencimento: string, hoje: string) =>
  Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${vencimento}T12:00:00Z`)) / 86400000);

/** O que fazer hoje. Paga em ate 5 dias apos o vencimento; no 6o dia bloqueia. */
export function acaoDoDia(m: any, hoje: string) {
  if (m.status !== 'ativa' || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.proximo_vencimento || ''))) return null;
  const atraso = diasDeAtraso(m.proximo_vencimento, hoje);
  if (atraso > DIAS_TOLERANCIA) return 'bloquear';
  if (atraso === -3) return 'lembrete';
  if (atraso === 0) return 'vence_hoje';
  if (atraso === 2) return 'atrasada';
  if (atraso === 4 || atraso === DIAS_TOLERANCIA) return 'ultimo_aviso';
  return null;
}
