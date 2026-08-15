import React from "react";
import { ShoppingCart, Package } from "lucide-react";

export default function LojaProductCard({ product, onAdd, primaryColor }) {
  const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {product.foto ? (
          <img src={product.foto} alt={product.nome} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-12 h-12 text-gray-300" />
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] uppercase text-gray-400">{product.categoria}</p>
        <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{product.nome}</p>
        {product.cod && <p className="text-[10px] text-gray-400 mt-0.5">SKU: {product.cod}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="font-bold text-lg" style={{ color: primaryColor }}>R$ {fmt(product.preco)}</span>
          <button onClick={() => onAdd(product)} className="text-white p-2 rounded-lg shadow-sm hover:opacity-90" style={{ backgroundColor: primaryColor }} aria-label="Adicionar ao carrinho">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}