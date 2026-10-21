// ─── Chamada da IA do Base44 com nova tentativa em limite de uso ────────────
// Item 009 / B5: numa rajada de mensagens a InvokeLLM devolveu "Rate limit exceeded"
// e o orçamento terminou em "Deu erro". Limite de uso (ou 429) tenta de novo com
// espera crescente; qualquer outro erro sobe na hora.

const ESPERAS_MS = [2000, 5000, 9000];
const LIMITE = /rate.?limit|429|too many requests/i;

export async function invocarIA(base44: any, args: any, esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await base44.asServiceRole.integrations.Core.InvokeLLM(args);
    } catch (e) {
      const msg = String((e as any)?.message || e);
      if (!LIMITE.test(msg) || tentativa >= ESPERAS_MS.length) throw e;
      console.warn('[IA] limite de uso, tentando de novo', tentativa + 1);
      await esperar(ESPERAS_MS[tentativa]);
    }
  }
}
