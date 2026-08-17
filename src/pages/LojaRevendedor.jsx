import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Store, ExternalLink } from "lucide-react";
import AdminStoreForm from "@/components/loja/AdminStoreForm";
import AdminOrders from "@/components/loja/AdminOrders";
import WhatsappCatalogo from "@/components/loja/WhatsappCatalogo";

export default function LojaRevendedor() {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("loja");

  const load = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me();
      setUser(u);
      const configs = await base44.entities.LojaConfig.filter({ revendedor_id: u.id });
      setConfig(configs[0] || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6" /> Minha Loja Online</h1>
        <p className="text-gray-500 text-sm">Configure sua loja, pegue o código de embed e cole no seu site. Os produtos exibidos são os da sua tabela (Meus Produtos).</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="loja">Minha Loja</TabsTrigger>
          <TabsTrigger value="visualizar">Visualizar Loja</TabsTrigger>
          <TabsTrigger value="whatsapp">Catálogo WhatsApp</TabsTrigger>
          <TabsTrigger value="pedidos">Meus Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="loja" className="space-y-4">
          {config?.ativo && config?.slug && (
            <a href={`/loja/${config.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <ExternalLink className="w-4 h-4" /> Ver minha loja pública
            </a>
          )}
          <div className="border rounded-xl p-4">
            <AdminStoreForm resellers={[user]} config={config} onSaved={load} lockReseller />
          </div>
        </TabsContent>

        <TabsContent value="visualizar">
          {config?.slug ? (
            <div className="space-y-2">
              <a href={`/loja/${config.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <ExternalLink className="w-4 h-4" /> Abrir em nova aba
              </a>
              <div className="rounded-xl overflow-hidden border shadow-sm">
                <iframe src={`/loja/${config.slug}?preview=1`} title="Preview da loja" className="w-full" style={{ height: "70vh", border: 0 }} />
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Salve sua loja (defina o slug) para visualizar.</p>
          )}
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsappCatalogo config={config} onSaved={load} />
        </TabsContent>

        <TabsContent value="pedidos">
          <AdminOrders stores={config ? [config] : []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}