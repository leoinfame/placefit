// Cálculo de lucro de um pedido (venda) item a item.
//
// Regra (AcordoComissao do revendedor por fabricante):
// - Se o fabricante paga comissão (paga_comissao=true), o lucro do item é o
//   percentual de comissão sobre o valor da venda (preco_unitario * qtd).
// - Caso contrário, o lucro é o markup (preço de venda - custo de fábrica).
//
// produtoMap: { [product_id]: { fabricante_nome, custo_fabricante } }
// comissaoMap: { [fabricante_nome]: { paga_comissao, percentual_comissao } }
export function computeLucroPedido(itens, produtoMap, comissaoMap) {
  let lucroTotal = 0;
  let custoTotal = 0;
  for (const item of (itens || [])) {
    const produto = produtoMap[item.product_id];
    if (!produto) continue; // item legado / produto não encontrado: não estima lucro
    const precoVenda = parseFloat(item.preco_unitario) || 0;
    const qtd = parseFloat(item.quantidade) || 0;
    const custo = parseFloat(produto.custo_fabricante) || 0;
    custoTotal += custo * qtd;
    const acordo = comissaoMap[produto.fabricante_nome];
    if (acordo && acordo.paga_comissao) {
      lucroTotal += ((parseFloat(acordo.percentual_comissao) || 0) / 100) * (precoVenda * qtd);
    } else {
      lucroTotal += (precoVenda - custo) * qtd;
    }
  }
  return { lucroTotal, custoTotal };
}