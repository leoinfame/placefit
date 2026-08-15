import React from "react";
import { X, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";

export default function LojaCart({ open, onClose, items, onInc, onDec, onRemove, subtotal, frete, total, onCheckout, primaryColor }) {
  const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: primaryColor }}>
          <h3 className="text-white font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Seu Carrinho</h3>
          <button onClick={onClose} className="text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center text-gray-400 py-20">Carrinho vazio</div>
          ) : items.map(it => (
            <div key={it.sp_id} className="flex gap-3 border-b pb-3">
              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {it.product.foto && <img src={it.product.foto} className="w-full h-full object-cover" alt={it.product.nome} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">{it.product.nome}</p>
                <p className="text-xs text-gray-500">R$ {fmt(it.product.preco)} / {it.product.und || 'un'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => onDec(it.sp_id)} className="p-1 rounded border"><Minus className="w-3 h-3" /></button>
                  <span className="text-sm font-semibold w-6 text-center">{it.quantidade}</span>
                  <button onClick={() => onInc(it.sp_id)} className="p-1 rounded border"><Plus className="w-3 h-3" /></button>
                  <button onClick={() => onRemove(it.sp_id)} className="ml-auto text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-sm font-bold text-gray-900 whitespace-nowrap">R$ {fmt(it.product.preco * it.quantidade)}</div>
            </div>
          ))}
        </div>
        <div className="border-t p-4 space-y-2 bg-gray-50">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>R$ {fmt(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Frete</span><span>{frete == null ? 'A calcular no checkout' : 'R$ ' + fmt(frete)}</span></div>
          <div className="flex justify-between font-bold text-lg"><span>Total</span><span>R$ {fmt(frete == null ? subtotal : total)}</span></div>
          <button disabled={items.length === 0} onClick={onCheckout} className="w-full text-white font-semibold py-3 rounded-lg disabled:opacity-50" style={{ backgroundColor: primaryColor }}>Finalizar Compra</button>
        </div>
      </div>
    </>
  );
}