import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getClienteArea } from "@/functions/getClienteArea";
import { updateClienteEndereco } from "@/functions/updateClienteEndereco";
import { getStoreData } from "@/functions/getStoreData";
import { Loader2, Store, User, Package, MapPin, LogOut, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const STATUS_LABEL = {
  pendente: "Pendente", confirmado: "Confirmado", pago: "Pago",
  enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
};
const STATUS_COLOR = {
  pendente: "bg-yellow-100 text-yellow-700", confirmado: "bg-blue-100 text-blue-700",
  pago: "bg-green-100 text-green-700", enviado: "bg-purple-100 text-purple-700",
  entregue: "bg-green-600 text-white", cancelado: "bg-red-100 text-red-700",
};

export default function LojaClienteArea() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cliente, setCliente] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [tab, setTab] = useState("pedidos");
  const [primary, setPrimary] = useState("#1e40af");

  const savedKey = `loja_cliente_${slug}`;

  useEffect(() => {
    // carregar config da loja para a cor
    getStoreData({ slug, preview: true }).then((res) => {
      const d = res.data || res;
      if (d?.config) { setConfig(d.config); setPrimary(d.config.cor_primaria || "#1e40af"); }
    }).catch(() => {});
    // restaurar sessao
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        const { email, cpf } = JSON.parse(saved);
        setEmail(email || ""); setCpf(cpf || "");
        login(email, cpf);
      } catch (e) {}
    }
  }, [slug]);

  const login = async (em, cp) => {
    if (!em) return;
    setLoadingLogin(true);
    try {
      const res = await getClienteArea({ slug, email: em, cpf: cp });
      const d = res.data || res;
      setCliente(d.cliente);
      setPedidos(d.pedidos || []);
      localStorage.setItem(savedKey, JSON.stringify({ email: em, cpf: cp }));
    } catch (e) {
      toast({ title: "Não encontrado", description: e?.response?.data?.error || "Verifique seus dados", variant: "destructive" });
      setCliente(null);
    }
    setLoadingLogin(false);
  };

  const logout = () => {
    localStorage.removeItem(savedKey);
    setCliente(null); setPedidos([]); setEmail(""); setCpf("");
  };

  if (loadingLogin && !cliente) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm" style={{ backgroundColor: primary }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to={`/loja/${slug}`} className="text-white/80 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          {config?.logo_url ? <img src={config.logo_url} className="h-8 w-8 rounded-lg object-cover" alt={config.nome_loja} /> : <Store className="w-6 h-6 text-white" />}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-sm leading-tight truncate">Minha Conta</h1>
            <p className="text-white/70 text-xs truncate">{config?.nome_loja || ""}</p>
          </div>
          {cliente && <button onClick={logout} className="text-white/80 hover:text-white p-1" title="Sair"><LogOut className="w-5 h-5" /></button>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {!cliente ? (
          <LoginForm email={email} setEmail={setEmail} cpf={cpf} setCpf={setCpf} onLogin={() => login(email, cpf)} loading={loadingLogin} primary={primary} />
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: primary }}>
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{cliente.nome}</p>
                <p className="text-xs text-gray-400 truncate">{cliente.email}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <TabBtn active={tab === "pedidos"} onClick={() => setTab("pedidos")} primary={primary}><Package className="w-4 h-4" /> Meus Pedidos</TabBtn>
              <TabBtn active={tab === "dados"} onClick={() => setTab("dados")} primary={primary}><MapPin className="w-4 h-4" /> Meus Dados</TabBtn>
            </div>

            {tab === "pedidos" ? (
              <PedidosList pedidos={pedidos} />
            ) : (
              <DadosForm cliente={cliente} primary={primary} onSaved={(c) => { setCliente(c); toast({ title: "Endereço atualizado!" }); }} />
            )}
          </div>
        )}
      </main>

      <footer className="border-t mt-8 py-6 text-center text-xs text-gray-400"><p>Powered by PlaceFit</p></footer>
    </div>
  );
}

function TabBtn({ active, onClick, primary, children }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "text-white" : "bg-white border text-gray-600"}`} style={active ? { backgroundColor: primary } : {}}>
      {children}
    </button>
  );
}

function LoginForm({ email, setEmail, cpf, setCpf, onLogin, loading, primary }) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 mt-6">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style={{ backgroundColor: primary }}>
          <User className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-bold text-gray-900 text-lg">Acesse sua conta</h2>
        <p className="text-sm text-gray-400">Entre com o e-mail usado nas compras para ver seus pedidos e dados.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
        <div>
          <Label>CPF (se cadastrado)</Label>
          <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
        </div>
        <Button onClick={onLogin} disabled={loading || !email} className="w-full text-white" style={{ backgroundColor: primary }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
        </Button>
      </div>
    </div>
  );
}

function PedidosList({ pedidos }) {
  if (!pedidos.length) return <div className="bg-white rounded-xl p-10 text-center text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>Você ainda não fez pedidos.</p></div>;
  return (
    <div className="space-y-3">
      {pedidos.map((p) => (
        <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-gray-500">{p.numero_pedido}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[p.status] || p.status}</span>
          </div>
          <div className="space-y-1">
            {(p.itens || []).map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{it.quantidade}x {it.nome}</span>
                <span className="text-gray-500">R$ {fmt(it.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t">
            <span className="text-xs text-gray-400">{p.created_date?.slice(0, 10)}</span>
            <span className="font-bold text-gray-900">R$ {fmt(p.total)}</span>
          </div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-gray-400">Pagamento: <span className="font-medium text-gray-600">{p.pagamento_status}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DadosForm({ cliente, primary, onSaved }) {
  const [form, setForm] = useState({
    cep: cliente.cep || "", endereco: cliente.endereco || "", numero: cliente.numero || "",
    complemento: cliente.complemento || "", bairro: cliente.bairro || "", cidade: cliente.cidade || "", estado: cliente.estado || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateClienteEndereco({ cliente_id: cliente.id, ...form });
      const d = res.data || res;
      onSaved(d.cliente);
    } catch (e) {
      setSaving(false);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4" /> Endereço de entrega</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <Label>CEP</Label>
          <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Logradouro</Label>
          <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
        </div>
        <div>
          <Label>Número</Label>
          <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Complemento</Label>
          <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
        </div>
        <div>
          <Label>Bairro</Label>
          <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
        </div>
        <div>
          <Label>Estado</Label>
          <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="w-full text-white" style={{ backgroundColor: primary }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Salvar endereço</>}
      </Button>
    </div>
  );
}