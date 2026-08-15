import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { authCliente } from "@/functions/authCliente";
import { getClienteArea } from "@/functions/getClienteArea";
import { updateClienteEndereco } from "@/functions/updateClienteEndereco";
import { getStoreData } from "@/functions/getStoreData";
import { getSession, setSession, clearSession } from "@/lib/lojaSession";
import { Loader2, Store, User, Package, MapPin, LogOut, CheckCircle2, ArrowLeft, UserPlus, LogIn, Truck, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const STATUS_FLOW = ["pendente", "confirmado", "pago", "enviado", "entregue"];
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
  const [sessao, setSessao] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pedidos");
  const [primary, setPrimary] = useState("#1e40af");

  useEffect(() => {
    let p = "#1e40af";
    getStoreData({ slug, preview: true }).then((res) => {
      const d = res.data || res;
      if (d?.config) { setConfig(d.config); p = d.config.cor_primaria || p; setPrimary(p); }
    }).catch(() => {});
    const s = getSession(slug);
    if (s) {
      setSessao(s);
      carregarDados(s);
    } else {
      setLoading(false);
    }
  }, [slug]);

  const carregarDados = async (s) => {
    setLoading(true);
    try {
      const res = await getClienteArea({ slug, cliente_id: s.cliente.id, token: s.token });
      const d = res.data || res;
      setSessao({ cliente: d.cliente, token: s.token });
      setPedidos(d.pedidos || []);
    } catch (e) {
      const msg = e?.response?.data?.error || "Sessão expirada";
      clearSession(slug); setSessao(null);
      toast({ title: "Sessão encerrada", description: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  const onAuth = (cliente, token) => {
    setSession(slug, cliente, token);
    setSessao({ cliente, token });
    carregarDados({ cliente, token });
  };

  const logout = () => {
    clearSession(slug); setSessao(null); setPedidos([]);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} /></div>;

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
          {sessao && <button onClick={logout} className="text-white/80 hover:text-white p-1" title="Sair"><LogOut className="w-5 h-5" /></button>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {!sessao ? (
          <AuthForm primary={primary} onAuth={onAuth} slug={slug} />
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: primary }}>
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">Olá, {sessao.cliente.nome?.split(" ")[0]}</p>
                <p className="text-xs text-gray-400 truncate">{sessao.cliente.email}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <TabBtn active={tab === "pedidos"} onClick={() => setTab("pedidos")} primary={primary}><Package className="w-4 h-4" /> Meus Pedidos</TabBtn>
              <TabBtn active={tab === "dados"} onClick={() => setTab("dados")} primary={primary}><MapPin className="w-4 h-4" /> Meus Dados</TabBtn>
            </div>

            {tab === "pedidos" ? (
              <PedidosList pedidos={pedidos} primary={primary} />
            ) : (
              <DadosForm cliente={sessao.cliente} token={sessao.token} primary={primary} onSaved={(c) => { setSessao({ ...sessao, cliente: c }); toast({ title: "Endereço atualizado!" }); }} />
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

function AuthForm({ primary, onAuth, slug }) {
  const [modo, setModo] = useState("login");
  const [form, setForm] = useState({ nome: "", email: "", cpf: "", telefone: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!form.email || !form.senha) { toast({ title: "Preencha e-mail e senha", variant: "destructive" }); return; }
    if (modo === "registro" && !form.nome) { toast({ title: "Preencha seu nome", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await authCliente({
        slug, acao: modo, nome: form.nome, email: form.email,
        cpf: form.cpf, telefone: form.telefone, senha: form.senha,
      });
      const d = res.data || res;
      onAuth(d.cliente, d.token);
      toast({ title: modo === "registro" ? "Conta criada!" : "Bem-vindo de volta!" });
    } catch (e) {
      toast({ title: "Erro", description: e?.response?.data?.error || "Tente novamente", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 mt-6">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setModo("login")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium ${modo === "login" ? "text-white" : "bg-gray-100 text-gray-600"}`} style={modo === "login" ? { backgroundColor: primary } : {}}>
          <LogIn className="w-4 h-4" /> Entrar
        </button>
        <button onClick={() => setModo("registro")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium ${modo === "registro" ? "text-white" : "bg-gray-100 text-gray-600"}`} style={modo === "registro" ? { backgroundColor: primary } : {}}>
          <UserPlus className="w-4 h-4" /> Criar Conta
        </button>
      </div>
      <div className="space-y-4">
        {modo === "registro" && (
          <div><Label>Nome completo*</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        )}
        <div><Label>E-mail*</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        {modo === "registro" && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          </div>
        )}
        <div><Label>Senha*</Label><Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
        <Button onClick={submit} disabled={loading} className="w-full text-white" style={{ backgroundColor: primary }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : modo === "login" ? "Entrar" : "Criar conta"}
        </Button>
        <p className="text-xs text-gray-400 text-center">
          {modo === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <button onClick={() => setModo(modo === "login" ? "registro" : "login")} className="font-medium" style={{ color: primary }}>
            {modo === "login" ? "Cadastre-se" : "Fazer login"}
          </button>
        </p>
      </div>
    </div>
  );
}

function PedidosList({ pedidos, primary }) {
  if (!pedidos.length) return <div className="bg-white rounded-xl p-10 text-center text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>Você ainda não fez pedidos.</p><p className="text-xs mt-1">Explore a loja e faça sua primeira compra!</p></div>;
  return (
    <div className="space-y-3">
      {pedidos.map((p) => <PedidoCard key={p.id} p={p} primary={primary} />)}
    </div>
  );
}

function PedidoCard({ p, primary }) {
  const [open, setOpen] = useState(false);
  const isCancel = p.status === "cancelado";
  const currentIdx = isCancel ? -1 : STATUS_FLOW.indexOf(p.status);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between">
        <div className="text-left">
          <p className="font-mono text-xs text-gray-500">{p.numero_pedido}</p>
          <p className="text-xs text-gray-400">{p.created_date?.slice(0, 10)} · {(p.itens || []).length} item(ns)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[p.status] || p.status}</span>
          <span className="font-bold text-gray-900">R$ {fmt(p.total)}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-4">
          {/* Timeline de acompanhamento */}
          <div className="flex items-center justify-between relative">
            <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200" />
            <div className="absolute top-3 left-0 h-0.5 transition-all" style={{ width: `${(currentIdx / (STATUS_FLOW.length - 1)) * 100}%`, backgroundColor: primary }} />
            {STATUS_FLOW.map((st, i) => {
              const done = i <= currentIdx;
              const Icon = st === "enviado" ? Truck : st === "entregue" ? CheckCircle2 : Clock;
              return (
                <div key={st} className="relative z-10 flex flex-col items-center gap-1 flex-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: done ? primary : "#cbd5e1" }}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] text-gray-500">{STATUS_LABEL[st]}</span>
                </div>
              );
            })}
          </div>
          {isCancel && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-2"><XCircle className="w-4 h-4" /> Pedido cancelado</div>}

          {/* Itens */}
          <div className="space-y-1">
            {(p.itens || []).map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{it.quantidade}x {it.nome}</span>
                <span className="text-gray-500">R$ {fmt(it.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-500 pt-2 border-t"><span>Subtotal</span><span>R$ {fmt(p.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>Frete</span><span>{Number(p.frete) === 0 ? "Grátis" : "R$ " + fmt(p.frete)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>R$ {fmt(p.total)}</span></div>
          <div className="flex gap-2 text-xs text-gray-400 pt-2 border-t">
            <span>Pagamento: <span className="font-medium text-gray-600">{p.pagamento_metodo} · {p.pagamento_status}</span></span>
          </div>
          {p.endereco_entrega && (
            <div className="text-xs text-gray-400 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5" />
              <span>{p.endereco_entrega.logradouro}, {p.endereco_entrega.numero} {p.endereco_entrega.complemento} — {p.endereco_entrega.bairro}, {p.endereco_entrega.cidade}/{p.endereco_entrega.estado}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DadosForm({ cliente, token, primary, onSaved }) {
  const [form, setForm] = useState({
    cep: cliente.cep || "", endereco: cliente.endereco || "", numero: cliente.numero || "",
    complemento: cliente.complemento || "", bairro: cliente.bairro || "", cidade: cliente.cidade || "", estado: cliente.estado || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateClienteEndereco({ cliente_id: cliente.id, token, ...form });
      const d = res.data || res;
      onSaved(d.cliente);
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4" /> Endereço de entrega</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1"><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
        <div className="col-span-2"><Label>Logradouro</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
        <div><Label>Número</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
        <div className="col-span-2"><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} /></div>
        <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
        <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
        <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} /></div>
      </div>
      <Button onClick={save} disabled={saving} className="w-full text-white" style={{ backgroundColor: primary }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Salvar endereço</>}
      </Button>
    </div>
  );
}