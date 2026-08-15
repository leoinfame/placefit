import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, ShoppingCart } from "lucide-react";

const STATUS = ["pendente", "confirmado", "pago", "enviado", "entregue", "cancelado"];

export default function AdminOrders({ stores }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.LojaPedido.list("-created_date", 200);
      setOrders(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const storeName = (rid) => stores.find((s) => s.revendedor_id === rid)?.nome_loja || "—";
  const filtered = orders.filter((o) => (filterStore === "all" || o.revendedor_id === filterStore) && (filterStatus === "all" || o.status === filterStatus));
  const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{stores.map((s) => <SelectItem key={s.id} value={s.revendedor_id}>{s.nome_loja}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" /><p>Nenhum pedido.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-2">Pedido</th><th className="text-left p-2">Loja</th><th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Itens</th><th className="text-right p-2">Total</th><th className="text-left p-2">Pagamento</th><th className="text-left p-2">Status</th><th className="text-left p-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{o.numero_pedido}</td>
                  <td className="p-2">{storeName(o.revendedor_id)}</td>
                  <td className="p-2"><p className="font-medium">{o.cliente_nome}</p><p className="text-xs text-gray-400">{o.cliente_email}</p></td>
                  <td className="p-2">{(o.itens || []).length}</td>
                  <td className="p-2 text-right font-semibold">R$ {fmt(o.total)}</td>
                  <td className="p-2"><Badge variant="outline">{o.pagamento_metodo}</Badge></td>
                  <td className="p-2"><Badge variant="secondary">{o.status}</Badge></td>
                  <td className="p-2 text-xs text-gray-400">{o.created_date?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}