import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, Package, FileText } from "lucide-react";
import AssinaturasTab from "@/components/pagamento/AssinaturasTab";
import PagamentoTab from "@/components/pagamento/PagamentoTab";
import FaturasTab from "@/components/pagamento/FaturasTab";

export default function MinhaConta() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ativando, setAtivando] = useState(false);
  const [assinaturas, setAssinaturas] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [metodoPagamento, setMetodoPagamento] = useState(null);
  const [contratando, setContratando] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me();
      setUser(u);

      // Ativar assinatura (processa InscricaoApp se houver)
      setAtivando(true);
      try {
        await base44.functions.invoke("inscreverApp", {
          ativar: true,
          user_id: u.id,
          user_email: u.email,
          user_nome: u.full_name,
        });
      } catch (e) {
        console.error("Ativação:", e);
      }
      setAtivando(false);

      // Carregar dados
      const [ass, fats, pls, metodos] = await Promise.all([
        base44.entities.AssinaturaUsuario.filter({ usuario_id: u.id }),
        base44.entities.FaturaAssinatura.filter({ usuario_id: u.id }),
        base44.entities.PlanoServico.filter({ ativo: true }),
        base44.entities.MetodoPagamento.filter({ usuario_id: u.id, ativo: true }),
      ]);

      setAssinaturas(ass);
      setFaturas(fats);
      setPlanos(pls);
      setMetodoPagamento(metodos[0] || null);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const contratar = async (plano) => {
    setContratando(plano.slug);
    try {
      await base44.functions.invoke("contratarRecurso", {
        user_id: user.id,
        user_email: user.email,
        user_nome: user.full_name,
        plano_slug: plano.slug,
      });
      toast({
        title: "Recurso contratado!",
        description: `${plano.nome} adicionado à sua conta.`,
      });
      const ass = await base44.entities.AssinaturaUsuario.filter({
        usuario_id: user.id,
      });
      setAssinaturas(ass);
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setContratando(null);
  };

  const handleCancelado = (assinaturaId) => {
    setAssinaturas((prev) =>
      prev.map((a) =>
        a.id === assinaturaId
          ? { ...a, status: "cancelado", cobranca_automatica: false }
          : a,
      ),
    );
    toast({ title: "Recurso cancelado", description: "O recurso foi cancelado com sucesso." });
  };

  const handleCardChanged = async () => {
    const metodos = await base44.entities.MetodoPagamento.filter({
      usuario_id: user.id,
      ativo: true,
    });
    setMetodoPagamento(metodos[0] || null);
    // Recarregar assinaturas para atualizar cobranca_automatica
    const ass = await base44.entities.AssinaturaUsuario.filter({
      usuario_id: user.id,
    });
    setAssinaturas(ass);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Conta</h1>
        <p className="text-gray-500 text-sm">
          {user?.full_name} • {user?.email}
        </p>
      </div>

      {ativando && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Ativando sua assinatura...
        </div>
      )}

      <Tabs defaultValue="assinaturas">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="assinaturas" className="gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Assinaturas</span>
          </TabsTrigger>
          <TabsTrigger value="pagamento" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Pagamento</span>
          </TabsTrigger>
          <TabsTrigger value="faturas" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Faturas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assinaturas" className="mt-6">
          <AssinaturasTab
            user={user}
            assinaturas={assinaturas}
            planos={planos}
            onContratar={contratar}
            onCancelar={handleCancelado}
            contratando={contratando}
          />
        </TabsContent>

        <TabsContent value="pagamento" className="mt-6">
          <PagamentoTab
            metodoPagamento={metodoPagamento}
            onCardChanged={handleCardChanged}
          />
        </TabsContent>

        <TabsContent value="faturas" className="mt-6">
          <FaturasTab faturas={faturas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}