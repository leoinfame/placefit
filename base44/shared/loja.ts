// Calculo de preco da vitrine publica de um revendedor.
// Preco promocional (sale_price) tem prioridade; caso contrario aplica margem sobre o preco de fabrica.
export const computeStorePrice = (sp) => {
  const base = Number(sp.preco) || 0;
  const margem = Number(sp.margem) || 0;
  const sale = Number(sp.sale_price) || 0;
  const price = sale > 0 ? sale : Math.round((base * (1 + margem / 100)) * 100) / 100;
  return price;
};