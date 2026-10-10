import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Save } from "lucide-react";
import { brl } from "../lib/hubApi";
import { useHub } from "../components/HubContexto";
import { Cartao, Vazio, Abas, Erro } from "../components/Cartao";
import { Campo, Selecao } from "../components/Campos";

const lista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);

export default function AdminCadastros() {
  const ctx = useHub();
  const [aba, setAba] = useState("perfis");
  const [perfis, setPerfis] = useState(null);
  const [bases, setBases] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [erro, setErro] = useState("");
  const [editPerfil, setEditPerfil] = useState(null);
  const [editBase, setEditBase] = useState(null);
  const [novaRevenda, setNovaRevenda] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [p, b, c] = await Promise.all([
        base44.entities.TransportProfile.list("nome", 500),
        base44.entities.HubBase.list("nome", 100),
        base44.entities.HubConfig.list("-created_date", 200),
      ]);
      setPerfis(p); setBases(b); setConfigs(c);
    } catch (e) { setErro(e.message); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const global = configs.find((c) => c.escopo === "global");
  const revendas = configs.filter((c) => c.escopo === "revenda");

  const salvarGlobal = async (dados) => {
    setErro("");
    try {
      const comAutor = { ...dados, atualizado_por: ctx.usuario.nome };
      if (global) await base44.entities.HubConfig.update(global.id, comAutor);
      else await base44.entities.HubConfig.create({ escopo: "global", taxa_falsa_coleta: 50, ...comAutor });
      await carregar();
      ctx.recarregar();
    } catch (e) { setErro(e.message); }
  };

  if (!perfis) return <div className="flex justify-center py-10">{erro ? <Erro texto={erro} /> : <Loader2 className="h-6 w-6 animate-spin" />}</div>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Cadastros do Hub</h1>
      <Abas abas={[["perfis", "Pessoas"], ["bases", "Bases"], ["revendas", "Revendas"], ["config", "Configuração"]]} ativa={aba} onTrocar={setAba} />
      <Erro texto={erro} />

      {aba === "perfis" && (
        <div className="space-y-2">
          <Button onClick={() => setEditPerfil({})}><Plus className="mr-1 h-4 w-4" />Novo perfil</Button>
          {perfis.length === 0 && <Vazio>Nenhum coletor, fretista ou operador de base cadastrado.</Vazio>}
          {perfis.map((p) => (
            <Cartao key={p.id} className="flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.nome} <span className="text-xs font-normal text-slate-500">· {p.tipo}</span></p>
                <p className="text-xs text-slate-500">
                  {p.tipo === "coletor" && (p.cidades?.length ? p.cidades.join(", ") : "todas as cidades")}
                  {p.tipo === "fretista" && (p.ufs?.length ? p.ufs.join(", ") : "todas as UFs")}
                  {p.tipo === "base" && (bases.find((b) => b.id === p.base_id)?.nome || "base não definida")}
                  {p.limite_valor ? ` · limite ${brl(p.limite_valor)}` : ""}{p.veiculo ? ` · ${p.veiculo}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.verificacao === "verificado" ? "bg-emerald-100 text-emerald-800" : p.verificacao === "suspenso" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                {p.ativo === false ? "inativo" : p.verificacao}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setEditPerfil(p)}><Pencil className="h-4 w-4" /></Button>
            </Cartao>
          ))}
        </div>
      )}

      {aba === "bases" && (
        <div className="space-y-2">
          <Button onClick={() => setEditBase({})}><Plus className="mr-1 h-4 w-4" />Nova base</Button>
          {bases.length === 0 && <Vazio>Cadastre o galpão do piloto.</Vazio>}
          {bases.map((b) => (
            <Cartao key={b.id} className="flex items-center gap-3 text-sm">
              <div className="flex-1">
                <p className="font-semibold">{b.nome}{global?.base_padrao_id === b.id ? " · padrão" : ""}</p>
                <p className="text-xs text-slate-500">{[b.endereco, b.cidade, b.uf].filter(Boolean).join(" — ")}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditBase(b)}><Pencil className="h-4 w-4" /></Button>
            </Cartao>
          ))}
        </div>
      )}

      {aba === "revendas" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Feature flag por revenda: com o Hub ligado, os pedidos dela aparecem em Pedidos e ela vê o acompanhamento e o sino na loja.</p>
          <Button onClick={() => setNovaRevenda(true)}><Plus className="mr-1 h-4 w-4" />Adicionar revenda</Button>
          {revendas.length === 0 && <Vazio>Nenhuma revenda configurada.</Vazio>}
          {revendas.map((r) => (
            <Cartao key={r.id} className="flex items-center gap-3 text-sm">
              <div className="flex-1">
                <p className="font-semibold">{r.revendedor_nome || r.revendedor_id}</p>
                <p className="text-xs text-slate-500">flag {r.flag || "—"}</p>
              </div>
              <span className="text-xs text-slate-500">{r.hub_ativo ? "Hub ligado" : "desligado"}</span>
              <Switch checked={!!r.hub_ativo} onCheckedChange={async (v) => {
                await base44.entities.HubConfig.update(r.id, { hub_ativo: v, atualizado_por: ctx.usuario.nome });
                carregar();
              }} />
            </Cartao>
          ))}
        </div>
      )}

      {aba === "config" && <ConfigGlobal global={global} bases={bases} onSalvar={salvarGlobal} />}

      {editPerfil && <PerfilDialog perfil={editPerfil} bases={bases} onFechar={() => setEditPerfil(null)} onFeito={() => { setEditPerfil(null); carregar(); }} />}
      {editBase && <BaseDialog base={editBase} onFechar={() => setEditBase(null)} onFeito={() => { setEditBase(null); carregar(); }} />}
      {novaRevenda && <RevendaDialog bases={bases} autor={ctx.usuario.nome} existentes={revendas} onFechar={() => setNovaRevenda(false)} onFeito={() => { setNovaRevenda(false); carregar(); }} />}
    </div>
  );
}

function ConfigGlobal({ global, bases, onSalvar }) {
  const [taxa, setTaxa] = useState(global?.taxa_falsa_coleta ?? 50);
  const [webhook, setWebhook] = useState(global?.webhook_url || "");
  const [base, setBase] = useState(global?.base_padrao_id || "");
  const [salvando, setSalvando] = useState(false);
  return (
    <Cartao className="max-w-lg space-y-3">
      <Campo rotulo="Taxa padrão de falsa coleta (R$) — devedor: fabricante · favorecido: coletor">
        <Input type="number" min="0" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
      </Campo>
      <Campo rotulo="Base padrão dos pedidos">
        <Selecao value={base} onChange={setBase}>
          <option value="">—</option>
          {bases.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </Selecao>
      </Campo>
      <Campo rotulo="Webhook (opcional): recebe POST JSON de cada notificação do Hub">
        <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://..." />
      </Campo>
      <Button disabled={salvando} onClick={async () => {
        setSalvando(true);
        await onSalvar({ taxa_falsa_coleta: Number(taxa) || 0, base_padrao_id: base || null, webhook_url: webhook.trim() || null });
        setSalvando(false);
      }}>
        {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar configuração
      </Button>
      {!global && <p className="text-xs text-amber-700">Ainda não salva — os valores acima são o padrão.</p>}
    </Cartao>
  );
}

// Busca o User pelo e-mail exato (o perfil sempre aponta para uma conta existente do PlaceFit).
async function buscarUsuario(email) {
  const r = await base44.entities.User.filter({ email: email.trim().toLowerCase() }, "-created_date", 1);
  return r?.[0] || null;
}

function PerfilDialog({ perfil, bases, onFechar, onFeito }) {
  const novo = !perfil.id;
  const [f, setF] = useState({
    tipo: perfil.tipo || "coletor", nome: perfil.nome || "", whatsapp: perfil.whatsapp || "", documento: perfil.documento || "",
    veiculo: perfil.veiculo || "", cidades: (perfil.cidades || []).join(", "), ufs: (perfil.ufs || []).join(", "),
    base_id: perfil.base_id || "", limite_valor: perfil.limite_valor ?? "", verificacao: perfil.verificacao || "pendente",
    ativo: perfil.ativo !== false, observacoes: perfil.observacoes || "",
  });
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });

  const salvar = async () => {
    setSalvando(true);
    setErro("");
    try {
      const dados = {
        ...f,
        cidades: lista(f.cidades),
        ufs: lista(f.ufs).map((u) => u.toUpperCase()),
        limite_valor: f.limite_valor === "" ? null : Number(f.limite_valor),
        base_id: f.base_id || null,
      };
      if (novo) {
        if (!usuario) throw new Error("Encontre a conta da pessoa pelo e-mail.");
        await base44.entities.TransportProfile.create({ ...dados, user_id: usuario.id });
      } else {
        await base44.entities.TransportProfile.update(perfil.id, dados);
      }
      onFeito();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{novo ? "Novo perfil de transporte" : f.nome}</DialogTitle>
          <DialogDescription>A pessoa entra com a mesma conta do PlaceFit. Só perfil verificado vê a fila.</DialogDescription>
        </DialogHeader>
        {novo && (
          <div className="flex items-end gap-2">
            <Campo rotulo="E-mail da conta PlaceFit" className="flex-1"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
            <Button variant="outline" onClick={async () => {
              setErro("");
              const u = await buscarUsuario(email).catch(() => null);
              if (!u) setErro("Nenhuma conta com esse e-mail. Peça para a pessoa entrar uma vez no PlaceFit.");
              setUsuario(u);
              if (u && !f.nome) set("nome", u.full_name || u.empresa || "");
            }}>Buscar</Button>
          </div>
        )}
        {novo && usuario && <p className="text-xs text-emerald-700">Conta encontrada: {usuario.full_name || usuario.email}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Tipo">
            <Selecao value={f.tipo} onChange={(v) => set("tipo", v)}>
              <option value="coletor">Coletor (fabricante → base)</option>
              <option value="fretista">Fretista (base → cliente)</option>
              <option value="base">Base (galpão)</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Nome"><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
          <Campo rotulo="WhatsApp"><Input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Campo>
          <Campo rotulo="CPF/CNPJ"><Input value={f.documento} onChange={(e) => set("documento", e.target.value)} /></Campo>
          {f.tipo !== "base" && <Campo rotulo="Veículo e placa"><Input value={f.veiculo} onChange={(e) => set("veiculo", e.target.value)} /></Campo>}
          {f.tipo !== "base" && <Campo rotulo="Limite de valor sob custódia (R$)"><Input type="number" value={f.limite_valor} onChange={(e) => set("limite_valor", e.target.value)} placeholder="sem limite" /></Campo>}
          {f.tipo === "coletor" && <Campo rotulo="Cidades atendidas (vírgula; vazio = todas)" className="col-span-2"><Input value={f.cidades} onChange={(e) => set("cidades", e.target.value)} placeholder="Cláudio, Itaúna, Carmo do Cajuru" /></Campo>}
          {f.tipo === "fretista" && <Campo rotulo="UFs de destino (vírgula; vazio = todas)" className="col-span-2"><Input value={f.ufs} onChange={(e) => set("ufs", e.target.value)} placeholder="MG, SP" /></Campo>}
          <Campo rotulo="Base">
            <Selecao value={f.base_id} onChange={(v) => set("base_id", v)}>
              <option value="">—</option>
              {bases.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Verificação">
            <Selecao value={f.verificacao} onChange={(v) => set("verificacao", v)}>
              <option value="pendente">Pendente</option>
              <option value="verificado">Verificado</option>
              <option value="suspenso">Suspenso</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Observações" className="col-span-2"><Input value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></Campo>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.ativo} onCheckedChange={(v) => set("ativo", v)} />Ativo</label>
        <Erro texto={erro} />
        <Button className="h-11" disabled={salvando || !f.nome} onClick={salvar}>{salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

function BaseDialog({ base, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: base.nome || "", endereco: base.endereco || "", cidade: base.cidade || "Cláudio", uf: base.uf || "MG", whatsapp: base.whatsapp || "", ativo: base.ativo !== false });
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    if (base.id) await base44.entities.HubBase.update(base.id, f); else await base44.entities.HubBase.create(f);
    setSalvando(false);
    onFeito();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{base.id ? base.nome : "Nova base"}</DialogTitle><DialogDescription>Galpão onde os subpedidos chegam e são consolidados.</DialogDescription></DialogHeader>
        <Campo rotulo="Nome"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Endereço"><Input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></Campo>
        <div className="grid grid-cols-3 gap-2">
          <Campo rotulo="Cidade" className="col-span-2"><Input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Campo>
          <Campo rotulo="UF"><Input maxLength={2} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })} /></Campo>
        </div>
        <Campo rotulo="WhatsApp"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Campo>
        <Button className="h-11" disabled={salvando || !f.nome} onClick={salvar}>Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

function RevendaDialog({ bases, autor, existentes, onFechar, onFeito }) {
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [flag, setFlag] = useState("");
  const [base, setBase] = useState("");
  const [erro, setErro] = useState("");
  const salvar = async () => {
    if (existentes.some((r) => r.revendedor_id === usuario.id)) return setErro("Esta revenda já está na lista.");
    await base44.entities.HubConfig.create({
      escopo: "revenda", revendedor_id: usuario.id, revendedor_nome: usuario.empresa || usuario.full_name,
      flag: flag || null, hub_ativo: true, base_padrao_id: base || null, atualizado_por: autor,
    });
    onFeito();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Ligar o Hub para uma revenda</DialogTitle><DialogDescription>Use o e-mail da conta da revenda no PlaceFit.</DialogDescription></DialogHeader>
        <div className="flex items-end gap-2">
          <Campo rotulo="E-mail da revenda" className="flex-1"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          <Button variant="outline" onClick={async () => {
            setErro("");
            const u = await buscarUsuario(email).catch(() => null);
            setUsuario(u);
            if (!u) setErro("Conta não encontrada.");
            else setFlag(`hub_${String(u.empresa || u.full_name || "revenda").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "")}`);
          }}>Buscar</Button>
        </div>
        {usuario && <p className="text-xs text-emerald-700">{usuario.empresa || usuario.full_name} ({usuario.email})</p>}
        <Campo rotulo="Nome da flag"><Input value={flag} onChange={(e) => setFlag(e.target.value)} /></Campo>
        <Campo rotulo="Base padrão">
          <Selecao value={base} onChange={setBase}>
            <option value="">Usar a base padrão global</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </Selecao>
        </Campo>
        <Erro texto={erro} />
        <Button className="h-11" disabled={!usuario} onClick={salvar}>Ligar o Hub</Button>
      </DialogContent>
    </Dialog>
  );
}
