// Aplica a margem da PlaceFit sobre o preço de fábrica quando o acordo do
// fabricante é do tipo "margem". Acordos do tipo "comissão" não alteram o
// preço exibido (a comissão é paga pelo fabricante sobre a venda, não embutida).

export async function loadMargemMap(base44) {
  const [acordos, fabricantes] = await Promise.all([
    base44.asServiceRole.entities.AcordoFabricante.list(),
    base44.asServiceRole.entities.Fabricante.list(),
  ]);

  // Mapa fabricante_id (entidade Fabricante) -> acordo ativo mais recente
  const byFabricanteId = {};
  for (const a of acordos) {
    if (a.ativo === false) continue;
    if (!a.fabricante_id) continue;
    const existing = byFabricanteId[a.fabricante_id];
    if (!existing || (a.updated_date || '') > (existing.updated_date || '')) {
      byFabricanteId[a.fabricante_id] = a;
    }
  }

  // Mapa supplier_id (user_id) -> acordo, via Fabricante.user_id
  const byUserId = {};
  for (const f of fabricantes) {
    const acordo = byFabricanteId[f.id];
    if (acordo && f.user_id) {
      byUserId[f.user_id] = acordo;
    }
  }

  return { byFabricanteId, byUserId };
}

export function applyMargem(preco, maps, fabricanteId, supplierId) {
  if (!preco || preco <= 0) return preco;
  if (!maps) return preco;

  let acordo = null;
  if (fabricanteId && maps.byFabricanteId[fabricanteId]) {
    acordo = maps.byFabricanteId[fabricanteId];
  } else if (supplierId && maps.byUserId[supplierId]) {
    acordo = maps.byUserId[supplierId];
  }

  if (!acordo) return preco;
  if (acordo.tipo_remuneracao !== 'margem') return preco;
  const pct = parseFloat(acordo.percentual) || 0;
  if (pct <= 0) return preco;

  return preco * (1 + pct / 100);
}