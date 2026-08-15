import React, { useState } from "react";
import { ShoppingCart, Package } from "lucide-react";

const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function LojaProductCard({ group, onAdd, primaryColor }) {
  const [idx, setIdx] = useState(0);
  const sel = group.variacoes[idx] || group.variacoes[0];

  const add = () => {
    onAdd({ id: sel.sp_id, sp_id: sel.sp_id, product_id: sel.product_id, nome: sel.nome, preco: sel.preco, foto: group.foto, und: group.und, peso_kg: sel.peso_kg });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {group.foto ? <img src={group.foto} alt={group.nome} className="w-full h-full object-cover" /> : <Package className="w-12 h-12 text-gray-300" />}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] uppercase text-gray-400">{group.categoria}</p>
        <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{group.nome}</p>
        {group.tem_pesos ? (
          <p className="text-xs text-gray-500 mt-0.5">a partir de <span className="font-bold" style={{ color: primaryColor }}>R$ {fmt(group.preco_por_kg)}/kg</span></p>
        ) : (
          <p className="text-[10px] text-gray-400 mt-0.5">{group.und}</p>
        )}
        {group.variacoes.length > 1 && (
          <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="mt-2 w-full border rounded-lg px-2 py-1.5 text-sm">
            {group.variacoes.map((v, i) => (
              <option key={v.sp_id} value={i}>{v.peso_kg ? v.peso_kg + ' kg' : v.nome} — R$ {fmt(v.preco)}</option>
            ))}
          </select>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="font-bold text-lg" style={{ color: primaryColor }}>R$ {fmt(sel.preco)}</span>
          <button onClick={add} className="text-white p-2 rounded-lg shadow-sm hover:opacity-90" style={{ backgroundColor: primaryColor }} aria-label="Adicionar ao carrinho">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}