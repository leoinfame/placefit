import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Package, List, Upload, BarChart3, Layers, Users, DollarSign, ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import CatalogoGeral from "@/components/produtos/CatalogoGeral";
import MeusProdutos from "@/components/produtos/MeusProdutos";
import ImportarTabela from "@/components/produtos/ImportarTabela";
import AdminProdutos from "@/components/produtos/AdminProdutos";

const getEffectiveUser = (user) => {
  if (!user) return null;
  if (user.role !== 'admin') return user;
  const mode = localStorage.getItem('admin_view_mode') || 'admin';
  if (mode === 'fornecedor') return { ...user, role: 'user', tipo_usuario: undefined, aprovado: true };
  if (mode === 'fabricante') return { ...user, role: 'user', tipo_usuario: 'fabricante', aprovado: true };
  if (mode === 'transportador') return { ...user, role: 'user', tipo_usuario: 'transportador', aprovado: true };
  return user;
};

function StatCard({ icon, label, value, color }) {
  const Icon = icon;
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Produtos() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ templates: 0, supplierProducts: 0, fabricantes: 0 });
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'catalogo';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && tab !== activeTab) setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        const eu = getEffectiveUser(u);
        setUser(eu);
        if (eu?.role === 'admin') loadStats();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadStats = async () => {
    try {
      const [tmpls, sps, fabs] = await Promise.all([
        base44.entities.ProductTemplate.filter({ ativo: true }),
        base44.entities.SupplierProduct.list('-created_date', 2000),
        base44.entities.User.filter({ tipo_usuario: 'fabricante' }),
      ]);
      setStats({
        templates: tmpls.length,
        supplierProducts: sps.length,
        fabricantes: fabs.length,
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === 'admin';
    const isFabricante = user.tipo_usuario === 'fabricante';
    const isRevendedor = !isFabricante && user.tipo_usuario !== 'transportador' && !isAdmin;
    const available = ['catalogo'];
    if (isAdmin) available.push('admin');
    if (isAdmin || isRevendedor) available.push('meus');
    if (isAdmin || isFabricante) available.push('importar');
    if (!available.includes(activeTab)) setActiveTab(isAdmin ? 'admin' : 'catalogo');
  }, [user, activeTab]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Faça login para acessar os produtos.</div>;
  }

  const isAdmin = user.role === 'admin';
  const isFabricante = user.tipo_usuario === 'fabricante';
  const isRevendedor = !isFabricante && user.tipo_usuario !== 'transportador' && !isAdmin;

  const tabs = [{ value: 'catalogo', label: 'Catálogo Geral', icon: Package }];
  if (isAdmin) tabs.unshift({ value: 'admin', label: 'Gerenciar Catálogo', icon: ShieldCheck });
  if (isAdmin || isRevendedor) tabs.push({ value: 'meus', label: 'Meus Produtos', icon: List });
  if (isAdmin || isFabricante) tabs.push({ value: 'importar', label: 'Importar Tabela', icon: Upload });

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-600 text-sm mt-1">Catálogo padronizado e gestão de preços</p>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Layers} label="Produtos no Catálogo" value={stats.templates} color="bg-blue-100 text-blue-600" />
            <StatCard icon={DollarSign} label="Preços Cadastrados" value={stats.supplierProducts} color="bg-green-100 text-green-600" />
            <StatCard icon={Users} label="Fabricantes Ativos" value={stats.fabricantes} color="bg-purple-100 text-purple-600" />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start flex-wrap h-auto">
            {tabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2">
                <t.icon className="w-4 h-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="admin"><AdminProdutos /></TabsContent>
          <TabsContent value="catalogo"><CatalogoGeral user={user} /></TabsContent>
          <TabsContent value="meus"><MeusProdutos user={user} /></TabsContent>
          <TabsContent value="importar"><ImportarTabela user={user} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}