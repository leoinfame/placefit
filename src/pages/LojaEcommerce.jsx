import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Store, Plus, Pencil, ExternalLink } from "lucide-react";
import AdminStoreForm from "@/components/loja/AdminStoreForm";
import AdminOrders from "@/components/loja/AdminOrders";

export default function LojaEcommerce() {
  const [tab, setTab] = useState("lojas");
  const [resellers, setResellers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [users, configs] = await Promise.all([
        base44.entities.User.filter({ role: "user" }),
        base44.entities.LojaConfig.list("-created_date", 200),
      ]);
      setResellers(users.filter((u) => u.tipo_usuario !== "fabricante" && u.tipo_usuario !== "transportador"));
      setStores(configs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6" /> E-commerce de Revendedores</h1>
        <p className="text-gray-500 text-sm">Crie lojas online para revendedores. O cliente final compra no site do revendedor (embed) e o pedido cai automaticamente aqui no PlaceFit.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lojas">Lojas ({stores.length})</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="lojas" className="space-y-4">
          {!showForm ? (
            <>
              <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1" /> Nova Loja</Button>
              {stores.length === 0 ? (
                <p className="text-gray-400 text-center py-10">Nenhuma loja criada ainda.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stores.map((s) => (
                    <div key={s.id} className="border rounded-xl p-4 flex items-center gap-3">
                      {s.logo_url ? <img src={s.logo_url} className="w-12 h-12 rounded-lg object-cover" alt={s.nome_loja} /> : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Store className="w-5 h-5 text-gray-400" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.nome_loja}</p>
                        <p className="text-xs text-gray-400 truncate">/loja/{s.slug}</p>
                        <p className="text-xs mt-0.5">{s.ativo ? <span className="text-green-600">Publicada</span> : <span className="text-gray-400">Rascunho</span>}</p>
                      </div>
                      <a href={`/loja/${s.slug}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-700"><ExternalLink className="w-4 h-4" /></a>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(s); setShowForm(true); }}><Pencil className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editing ? "Editar Loja" : "Nova Loja"}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Voltar</Button>
              </div>
              <AdminStoreForm resellers={resellers} config={editing} onSaved={() => { setShowForm(false); load(); }} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="pedidos">
          <AdminOrders stores={stores} />
        </TabsContent>
      </Tabs>
    </div>
  );
}