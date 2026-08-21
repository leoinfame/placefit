import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import WhatsAppSetup from "@/components/whatsapp/WhatsAppSetup";
import {
  ArrowUpRight, Check, CheckCheck, ChevronRight, CircleAlert, ClipboardList, Copy,
  FileText, LayoutGrid, Loader2, MessageCircle, MessageSquare, Plus, RefreshCw,
  Search, Send, Settings, Smartphone, Trash2, Users, Wifi, WifiOff, X
} from "lucide-react";

const STAGES = [
  { value: "novo", label: "Novo contato", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { value: "atendimento", label: "Em atendimento", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { value: "orcamento", label: "Orçamento", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { value: "negociacao", label: "Negociação", color: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  { value: "ganho", label: "Venda ganha", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { value: "perdido", label: "Não convertido", color: "bg-rose-100 text-rose-700", dot: "bg-rose-500" }
];

const stageFor = (value) => STAGES.find((item) => item.value === value) || STAGES[0];
const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : digits.length >= 10 ? "55" + digits : digits;
};
const formatPhone = (value) => {
  const digits = normalizePhone(value);
  if (!digits) return "Sem telefone";
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return local.length >= 10 ? "+55 (" + local.slice(0, 2) + ") " + local.slice(2, -4) + "-" + local.slice(-4) : "+" + digits;
};
const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

function StatusIcon({ status }) {
  if (status === "erro") return <CircleAlert className="h-3.5 w-3.5 text-red-500" />;
  if (status === "lida") return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  if (status === "entregue") return <CheckCheck className="h-3.5 w-3.5 text-slate-500" />;
  return <Check className="h-3.5 w-3.5 text-slate-500" />;
}

export default function CRMWhatsApp() {
  const { toast } = useToast();
  const scrollRef = useRef(null);
  const [me, setMe] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [ownerId, setOwnerId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("conversas");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [newContact, setNewContact] = useState({ cliente_id: "", nome: "", telefone: "" });
  const [newTemplate, setNewTemplate] = useState({ titulo: "", conteudo: "" });

  useEffect(() => { initialize(); }, []);
  useEffect(() => {
    if (ownerId) loadWorkspace(ownerId);
  }, [ownerId]);
  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId]);
  useEffect(() => {
    if (!ownerId || !base44.entities.CRMMensagem?.subscribe) return undefined;
    try {
      const unsubscribeMessages = base44.entities.CRMMensagem.subscribe((event) => {
        if (event?.data?.owner_id !== ownerId) return;
        if (event?.data?.conversa_id === selectedId) loadMessages(selectedId);
        loadConversations(ownerId);
      });
      const unsubscribeConversations = base44.entities.CRMConversa.subscribe((event) => {
        if (event?.data?.owner_id === ownerId) loadConversations(ownerId);
      });
      return () => {
        unsubscribeMessages?.();
        unsubscribeConversations?.();
      };
    } catch {
      return undefined;
    }
  }, [ownerId, selectedId]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function initialize() {
    try {
      const user = await base44.auth.me();
      setMe(user);
      if (user.role === "admin") {
        const users = await base44.entities.User.list("-created_date", 500);
        const usable = (users || [])
          .filter((item) => item.role !== "admin" || item.id === user.id)
          .map((item) => ({
            id: item.id,
            name: item.empresa || item.full_name || item.email,
            configured: Boolean(item.whatsapp_phone_number_id && item.whatsapp_access_token),
            active: Boolean(item.whatsapp_atendente_ativo)
          }));
        const sorted = usable.sort((a, b) => Number(b.configured) - Number(a.configured) || a.name.localeCompare(b.name));
        setAccounts(sorted);
        const preferred = sorted.find((item) => item.configured && item.active) || sorted.find((item) => item.configured);
        setOwnerId(preferred?.id || user.id);
      } else {
        setAccounts([{ id: user.id, name: user.empresa || user.full_name || user.email }]);
        setOwnerId(user.id);
      }
    } catch (error) {
      toast({ title: "Erro ao abrir o CRM", description: error?.message || "Não foi possível carregar a conta.", variant: "destructive" });
      setLoading(false);
    }
  }

  async function loadConversations(id) {
    const rows = await base44.entities.CRMConversa.filter({ owner_id: id, ativo: true }, "-ultima_interacao", 500);
    setConversations(rows || []);
    return rows || [];
  }

  async function loadWorkspace(id) {
    setLoading(true);
    try {
      const [rows, customerRows, templateRows, result] = await Promise.all([
        loadConversations(id),
        base44.entities.Cliente.filter({ fornecedor_id: id }, "-created_date", 500).catch(() => []),
        base44.entities.CRMTemplate.filter({ owner_id: id, ativo: true }, "-updated_date", 200).catch(() => []),
        base44.functions.invoke("crm-whatsapp", { action: "status", owner_id: id }).catch(() => null)
      ]);
      setCustomers(customerRows || []);
      setTemplates(templateRows || []);
      setStatus(result?.data || null);
      setSelectedId((current) => rows.some((item) => item.id === current) ? current : (rows[0]?.id || ""));
    } catch (error) {
      toast({ title: "Erro ao carregar o CRM", description: error?.response?.data?.error || error?.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshWorkspace() {
    setRefreshing(true);
    await loadWorkspace(ownerId);
  }

  async function loadMessages(conversationId) {
    try {
      const rows = await base44.entities.CRMMensagem.filter({ conversa_id: conversationId }, "created_date", 500);
      setMessages(rows || []);
      const current = conversations.find((item) => item.id === conversationId);
      if (current?.nao_lidas) {
        await base44.entities.CRMConversa.update(conversationId, { nao_lidas: 0 });
        setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, nao_lidas: 0 } : item));
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens", error);
    }
  }

  const selected = useMemo(() => conversations.find((item) => item.id === selectedId) || null, [conversations, selectedId]);
  const filtered = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return conversations;
    return conversations.filter((item) =>
      [item.nome_contato, item.telefone, item.ultima_mensagem].some((field) => String(field || "").toLowerCase().includes(value))
    );
  }, [conversations, search]);

  async function createConversation() {
    const selectedCustomer = customers.find((item) => item.id === newContact.cliente_id);
    const name = (newContact.nome || selectedCustomer?.nome || "").trim();
    const phone = normalizePhone(newContact.telefone || selectedCustomer?.telefone || selectedCustomer?.whatsapp);
    if (!name || !phone) {
      toast({ title: "Informe nome e WhatsApp", variant: "destructive" });
      return;
    }
    try {
      const existing = conversations.find((item) => normalizePhone(item.telefone) === phone);
      if (existing) {
        setSelectedId(existing.id);
        setNewOpen(false);
        setTab("conversas");
        return;
      }
      const record = await base44.entities.CRMConversa.create({
        owner_id: ownerId,
        cliente_id: selectedCustomer?.id || "",
        nome_contato: name,
        telefone: phone,
        etapa: "novo",
        ultima_mensagem: "",
        ultima_interacao: new Date().toISOString(),
        nao_lidas: 0,
        origem: "crm",
        ativo: true
      });
      await loadConversations(ownerId);
      setSelectedId(record.id);
      setNewOpen(false);
      setTab("conversas");
      setNewContact({ cliente_id: "", nome: "", telefone: "" });
    } catch (error) {
      toast({ title: "Não foi possível criar a conversa", description: error?.message, variant: "destructive" });
    }
  }

  async function updateStage(conversation, stage) {
    try {
      await base44.entities.CRMConversa.update(conversation.id, { etapa: stage });
      setConversations((items) => items.map((item) => item.id === conversation.id ? { ...item, etapa: stage } : item));
    } catch (error) {
      toast({ title: "Erro ao atualizar a etapa", description: error?.message, variant: "destructive" });
    }
  }

  async function sendMessage(template) {
    if (!selected) return;
    if (!status?.configured) {
      toast({ title: "WhatsApp não configurado", description: "Abra a aba Configuração para conectar a conta.", variant: "destructive" });
      setTab("configuracao");
      return;
    }
    if (!template && !draft.trim()) return;
    setSending(true);
    try {
      const payload = template
        ? { action: "send_template", template_id: template.id, template_name: template.nome }
        : { action: "send_text", text: draft.trim() };
      await base44.functions.invoke("crm-whatsapp", {
        ...payload,
        owner_id: ownerId,
        conversa_id: selected.id,
        to: selected.telefone
      });
      setDraft("");
      setTemplatePickerOpen(false);
      await Promise.all([loadMessages(selected.id), loadConversations(ownerId)]);
      toast({ title: template ? "Template enviado" : "Mensagem enviada" });
    } catch (error) {
      await loadMessages(selected.id);
      toast({
        title: "Falha no envio",
        description: error?.response?.data?.error || error?.message || "Confira a conexão e a janela de atendimento do WhatsApp.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  }

  async function syncTemplates() {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke("crm-whatsapp", { action: "sync_templates", owner_id: ownerId });
      const count = response?.data?.count || 0;
      const rows = await base44.entities.CRMTemplate.filter({ owner_id: ownerId, ativo: true }, "-updated_date", 200);
      setTemplates(rows || []);
      toast({ title: "Templates sincronizados", description: count + " modelo(s) encontrado(s) na Meta." });
    } catch (error) {
      toast({ title: "Não foi possível sincronizar", description: error?.response?.data?.error || error?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function createTemplate() {
    if (!newTemplate.titulo.trim() || !newTemplate.conteudo.trim()) {
      toast({ title: "Informe título e mensagem", variant: "destructive" });
      return;
    }
    try {
      const name = newTemplate.titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const row = await base44.entities.CRMTemplate.create({
        owner_id: ownerId,
        nome: name || "mensagem_rapida",
        titulo: newTemplate.titulo.trim(),
        conteudo: newTemplate.conteudo.trim(),
        categoria: "LOCAL",
        idioma: "pt_BR",
        status: "LOCAL",
        origem: "local",
        ativo: true
      });
      setTemplates((items) => [row, ...items]);
      setTemplateOpen(false);
      setNewTemplate({ titulo: "", conteudo: "" });
      toast({ title: "Mensagem rápida criada" });
    } catch (error) {
      toast({ title: "Erro ao criar template", description: error?.message, variant: "destructive" });
    }
  }

  async function archiveTemplate(template) {
    try {
      await base44.entities.CRMTemplate.update(template.id, { ativo: false });
      setTemplates((items) => items.filter((item) => item.id !== template.id));
    } catch (error) {
      toast({ title: "Erro ao remover template", description: error?.message, variant: "destructive" });
    }
  }

  function useTemplate(template) {
    if (template.origem === "meta" && template.status === "APPROVED") {
      if (!selected) {
        toast({ title: "Selecione uma conversa primeiro", variant: "destructive" });
        setTab("conversas");
        return;
      }
      sendMessage(template);
      return;
    }
    setDraft(template.conteudo);
    setTemplatePickerOpen(false);
    setTab("conversas");
    if (!selected) toast({ title: "Selecione uma conversa para usar esta mensagem." });
  }

  const unread = conversations.reduce((sum, item) => sum + Number(item.nao_lidas || 0), 0);
  const inProgress = conversations.filter((item) => ["atendimento", "orcamento", "negociacao"].includes(item.etapa)).length;
  const won = conversations.filter((item) => item.etapa === "ganho").length;
  const webhookUrl = typeof window !== "undefined" ? window.location.origin + "/functions/crm-whatsapp-webhook" : "";

  if (loading && !me) {
    return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-1 py-4 md:px-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white"><MessageCircle className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">CRM WhatsApp</h1>
              <p className="text-sm text-slate-500">Conversas, contatos, funil comercial e templates.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {me?.role === "admin" && accounts.length > 1 && (
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="w-[250px] bg-white"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
              <SelectContent>
                {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}{account.configured ? " · WhatsApp" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Badge className={status?.configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
            {status?.configured ? <Wifi className="mr-1.5 h-3.5 w-3.5" /> : <WifiOff className="mr-1.5 h-3.5 w-3.5" />}
            {status?.configured ? "WhatsApp conectado" : "Configuração pendente"}
          </Badge>
          <Button variant="outline" size="icon" onClick={refreshWorkspace} disabled={refreshing}><RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} /></Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setNewOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova conversa</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Conversas", value: conversations.length, icon: MessageSquare, color: "text-slate-700 bg-slate-100" },
          { label: "Não lidas", value: unread, icon: MessageCircle, color: "text-blue-700 bg-blue-100" },
          { label: "Em negociação", value: inProgress, icon: LayoutGrid, color: "text-amber-700 bg-amber-100" },
          { label: "Vendas ganhas", value: won, icon: CheckCheck, color: "text-emerald-700 bg-emerald-100" }
        ].map((metric) => (
          <Card key={metric.label} className="border-slate-200 shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={"rounded-xl p-2.5 " + metric.color}><metric.icon className="h-4 w-4" /></div>
              <div><p className="text-xs text-slate-500">{metric.label}</p><p className="text-xl font-semibold text-slate-900">{metric.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="conversas" className="gap-2"><MessageSquare className="h-4 w-4" />Conversas</TabsTrigger>
          <TabsTrigger value="funil" className="gap-2"><LayoutGrid className="h-4 w-4" />Funil comercial</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="configuracao" className="gap-2"><Settings className="h-4 w-4" />Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="mt-0">
          <div className="grid min-h-[610px] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[350px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-100 p-4">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contato ou mensagem..." className="h-10 border-slate-200 pl-9" /></div>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-6 py-16 text-center"><Users className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">Nenhuma conversa encontrada.</p><Button variant="link" onClick={() => setNewOpen(true)}>Criar primeiro contato</Button></div>
                ) : filtered.map((conversation) => (
                  <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={"flex w-full gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 " + (selectedId === conversation.id ? "bg-emerald-50" : "")}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{conversation.nome_contato?.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-900">{conversation.nome_contato}</p><span className="shrink-0 text-[11px] text-slate-400">{formatTime(conversation.ultima_interacao)}</span></div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{conversation.ultima_mensagem || formatPhone(conversation.telefone)}</p>
                      <div className="mt-2 flex items-center justify-between"><Badge className={"border-0 text-[10px] " + stageFor(conversation.etapa).color}>{stageFor(conversation.etapa).label}</Badge>{conversation.nao_lidas > 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">{conversation.nao_lidas}</span>}</div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {!selected ? (
              <div className="flex min-h-[460px] flex-col items-center justify-center bg-slate-50 px-6 text-center"><MessageCircle className="h-14 w-14 text-slate-300" /><h2 className="mt-4 text-lg font-semibold text-slate-800">Selecione uma conversa</h2><p className="mt-1 max-w-sm text-sm text-slate-500">Escolha um contato ao lado ou inicie uma nova conversa pelo WhatsApp.</p></div>
            ) : (
              <section className="flex min-h-[610px] flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div><p className="font-semibold text-slate-900">{selected.nome_contato}</p><p className="text-xs text-slate-500">{formatPhone(selected.telefone)}</p></div>
                  <div className="flex items-center gap-2">
                    <Select value={selected.etapa || "novo"} onValueChange={(value) => updateStage(selected, value)}><SelectTrigger className="h-9 w-[175px]"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((stage) => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}</SelectContent></Select>
                    <Button variant="outline" size="icon" onClick={() => window.open("https://wa.me/" + normalizePhone(selected.telefone), "_blank", "noopener,noreferrer")} title="Abrir no WhatsApp"><ArrowUpRight className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-[#f4f5f1] px-4 py-5 md:px-7" style={{ maxHeight: 440 }}>
                  {messages.length === 0 && <div className="mx-auto max-w-sm rounded-xl bg-white p-4 text-center text-sm text-slate-500 shadow-sm">Nenhuma mensagem ainda. Envie um texto ou use um template aprovado pela Meta.</div>}
                  {messages.map((message) => (
                    <div key={message.id} className={"flex " + (message.direcao === "enviada" ? "justify-end" : "justify-start")}>
                      <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm " + (message.direcao === "enviada" ? "rounded-br-md bg-[#dcf8c6]" : "rounded-bl-md bg-white")}>
                        {message.tipo === "template" && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Template WhatsApp</p>}
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{message.conteudo}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">{formatTime(message.created_date)} {message.direcao === "enviada" && <StatusIcon status={message.status} />}</div>
                        {message.erro && <p className="mt-1 text-[10px] text-red-600">{message.erro}</p>}
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
                <div className="border-t border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setTemplatePickerOpen(true)}><FileText className="h-3.5 w-3.5" />Templates</Button>
                    {!status?.configured && <span className="text-xs text-amber-700">Conecte o WhatsApp para enviar mensagens.</span>}
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Digite uma mensagem..." className="min-h-[48px] resize-none border-slate-200" rows={2} />
                    <Button onClick={() => sendMessage()} disabled={sending || !draft.trim()} className="h-12 w-12 shrink-0 bg-emerald-600 p-0 hover:bg-emerald-700">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="funil" className="mt-0">
          <div className="grid gap-4 overflow-x-auto pb-3 md:grid-cols-2 xl:grid-cols-3">
            {STAGES.map((stage) => {
              const rows = conversations.filter((conversation) => (conversation.etapa || "novo") === stage.value);
              return <div key={stage.value} className="min-h-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={"h-2.5 w-2.5 rounded-full " + stage.dot} /><span className="text-sm font-semibold text-slate-800">{stage.label}</span></div><Badge variant="secondary">{rows.length}</Badge></div>
                <div className="space-y-2">{rows.map((conversation) => <button key={conversation.id} onClick={() => { setSelectedId(conversation.id); setTab("conversas"); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-300"><p className="text-sm font-semibold text-slate-900">{conversation.nome_contato}</p><p className="mt-1 text-xs text-slate-500">{formatPhone(conversation.telefone)}</p><p className="mt-2 truncate text-xs text-slate-400">{conversation.ultima_mensagem || "Sem mensagens"}</p></button>)}</div>
              </div>;
            })}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-0 space-y-4">
          <Card className="border-slate-200 shadow-none"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold text-slate-900">Templates e mensagens rápidas</h2><p className="mt-1 text-sm text-slate-500">Modelos aprovados pela Meta iniciam conversas; mensagens rápidas agilizam atendimentos já abertos.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={syncTemplates} disabled={syncing || !status?.configured}><RefreshCw className={"mr-2 h-4 w-4 " + (syncing ? "animate-spin" : "")} />Sincronizar Meta</Button><Button onClick={() => setTemplateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" />Novo template</Button></div></CardContent></Card>
          {templates.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><FileText className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-medium text-slate-700">Nenhum template cadastrado.</p><p className="mt-1 text-sm text-slate-500">Crie uma mensagem rápida ou sincronize os modelos aprovados na Meta.</p></div> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <Card key={template.id} className="border-slate-200 shadow-none"><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{template.titulo || template.nome}</h3><p className="mt-0.5 text-xs text-slate-400">{template.idioma || "pt_BR"} · {template.categoria || "LOCAL"}</p></div><Badge className={template.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : template.status === "LOCAL" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>{template.status === "APPROVED" ? "Aprovado Meta" : template.status === "LOCAL" ? "Mensagem rápida" : template.status}</Badge></div><p className="line-clamp-4 min-h-[60px] whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{template.conteudo}</p><div className="flex items-center justify-between"><Button variant="outline" size="sm" onClick={() => useTemplate(template)}><Send className="mr-1.5 h-3.5 w-3.5" />Usar</Button><Button variant="ghost" size="icon" onClick={() => archiveTemplate(template)} title="Remover template"><Trash2 className="h-4 w-4 text-slate-400" /></Button></div></CardContent></Card>)}</div>
          )}
        </TabsContent>

        <TabsContent value="configuracao" className="mt-0 space-y-4">
          <Card className="border-emerald-200 bg-emerald-50 shadow-none"><CardContent className="p-5"><div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 text-emerald-700" /><div className="min-w-0 flex-1"><p className="font-semibold text-emerald-900">Webhook do CRM PlaceFit</p><p className="mt-1 text-sm text-emerald-800">Cadastre esta URL na Meta e marque o evento <strong>messages</strong>. O token deve ser igual ao configurado abaixo.</p><div className="mt-3 flex flex-wrap items-center gap-2"><code className="break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-700">{webhookUrl}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "URL copiada" }); }}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button></div></div></div></CardContent></Card>
          {ownerId === me?.id ? <WhatsAppSetup userId={ownerId} userType={me?.role === "admin" ? "admin" : "revendedor"} /> : <Card className="border-slate-200 shadow-none"><CardContent className="p-5"><p className="font-medium text-slate-800">Conta selecionada: {accounts.find((account) => account.id === ownerId)?.name}</p><p className="mt-2 text-sm text-slate-500">As credenciais do WhatsApp são configuradas pelo próprio usuário em Atendente IA → WhatsApp. O administrador pode acompanhar conversas, sincronizar templates e enviar mensagens pelo CRM.</p><div className="mt-4 flex items-center gap-2"><Badge className={status?.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{status?.configured ? "Credenciais configuradas" : "Credenciais pendentes"}</Badge>{status?.phone_number_id && <span className="text-xs text-slate-500">Phone Number ID: {status.phone_number_id}</span>}</div></CardContent></Card>}
        </TabsContent>
      </Tabs>

      <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nova conversa WhatsApp</DialogTitle><DialogDescription>Escolha um cliente existente ou informe um novo contato.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Cliente cadastrado</Label><Select value={newContact.cliente_id || "manual"} onValueChange={(value) => { const customer = customers.find((item) => item.id === value); setNewContact({ cliente_id: value === "manual" ? "" : value, nome: customer?.nome || "", telefone: customer?.telefone || "" }); }}><SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger><SelectContent><SelectItem value="manual">Informar contato manualmente</SelectItem>{customers.filter((customer) => customer.telefone).map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.nome} · {formatPhone(customer.telefone)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Nome do contato</Label><Input value={newContact.nome} onChange={(event) => setNewContact({ ...newContact, nome: event.target.value })} placeholder="Nome ou empresa" /></div><div className="space-y-2"><Label>WhatsApp</Label><Input value={newContact.telefone} onChange={(event) => setNewContact({ ...newContact, telefone: event.target.value })} placeholder="(37) 99999-9999" /></div><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={createConversation}>Iniciar conversa</Button></div></div></DialogContent></Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nova mensagem rápida</DialogTitle><DialogDescription>Crie um texto reutilizável para conversas já abertas. Templates oficiais devem ser aprovados pela Meta.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Título</Label><Input value={newTemplate.titulo} onChange={(event) => setNewTemplate({ ...newTemplate, titulo: event.target.value })} placeholder="Ex.: Primeiro contato comercial" /></div><div className="space-y-2"><Label>Mensagem</Label><Textarea value={newTemplate.conteudo} onChange={(event) => setNewTemplate({ ...newTemplate, conteudo: event.target.value })} placeholder="Olá! Somos da PlaceFit e gostaríamos de apresentar..." className="min-h-[130px]" /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={createTemplate}>Salvar template</Button></div></div></DialogContent></Dialog>

      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Selecionar template</DialogTitle><DialogDescription>Escolha um modelo aprovado pela Meta ou uma mensagem rápida.</DialogDescription></DialogHeader><div className="max-h-[420px] space-y-2 overflow-y-auto py-2">{templates.length === 0 ? <div className="py-10 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">Nenhum template disponível.</p><Button variant="link" onClick={() => { setTemplatePickerOpen(false); setTab("templates"); }}>Gerenciar templates</Button></div> : templates.map((template) => <button key={template.id} onClick={() => useTemplate(template)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{template.titulo || template.nome}</p><Badge className={template.origem === "meta" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>{template.origem === "meta" ? "Meta" : "Rápido"}</Badge></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.conteudo}</p></button>)}</div></DialogContent></Dialog>
    </div>
  );
}
