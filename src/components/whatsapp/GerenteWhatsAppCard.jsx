// Item 006 (16/10/2026): o revendedor liga o proprio celular ao Gerente PlaceFit no WhatsApp oficial.
// Linguagem simples, sem termos tecnicos. O vinculo so vale depois que ele manda o codigo do proprio celular.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, Smartphone, MessageCircle, Copy } from "lucide-react";

const formatarNumero = (d) => {
  const s = String(d || "").replace(/\D/g, "");
  const n = s.startsWith("55") ? s.slice(2) : s;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return s;
};

export default function GerenteWhatsAppCard() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trocando, setTrocando] = useState(false);
  const { toast } = useToast();

  const carregar = async () => {
    try {
      const r = await base44.functions.invoke("vinculoGerente", { action: "status" });
      setInfo(r?.data || null);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  // Enquanto espera o codigo, confere sozinho se ja ativou
  useEffect(() => {
    if (!codigo) return;
    const t = setInterval(async () => {
      const r = await base44.functions.invoke("vinculoGerente", { action: "status" }).catch(() => null);
      if (r?.data?.vinculo?.verificado) {
        setInfo(r.data);
        setCodigo("");
        setTrocando(false);
        toast({ title: "Tudo certo!", description: "Seu celular já está ligado ao Gerente PlaceFit." });
      }
    }, 5000);
    return () => clearInterval(t);
  }, [codigo]);

  const gerarCodigo = async () => {
    setBusy(true);
    try {
      const r = await base44.functions.invoke("vinculoGerente", { action: "iniciar", telefone });
      setCodigo(r?.data?.codigo || "");
      setInfo((i) => ({ ...(i || {}), numero_oficial: r?.data?.numero_oficial || i?.numero_oficial }));
    } catch (e) {
      toast({ title: "Não deu certo", description: e?.response?.data?.error || "Confira o número e tente de novo.", variant: "destructive" });
    }
    setBusy(false);
  };

  const desligar = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke("vinculoGerente", { action: "remover" });
      setCodigo("");
      setTelefone("");
      await carregar();
      toast({ title: "Celular desligado do Gerente" });
    } catch {
      toast({ title: "Não deu certo", variant: "destructive" });
    }
    setBusy(false);
  };

  if (loading) return null;

  const oficial = info?.numero_oficial || "";
  const verificado = Boolean(info?.vinculo?.verificado);
  const textoAtivar = codigo ? `ATIVAR ${codigo}` : "";
  const linkWhats = oficial && codigo ? `https://wa.me/${oficial}?text=${encodeURIComponent(textoAtivar)}` : "";

  return (
    <Card className={`border-2 ${verificado ? "border-green-300 bg-green-50" : "border-blue-200 bg-white"}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <MessageCircle className={`w-6 h-6 mt-0.5 ${verificado ? "text-green-600" : "text-blue-600"}`} />
          <div>
            <p className="font-bold text-gray-900">Gerente PlaceFit no seu WhatsApp</p>
            <p className="text-sm text-gray-600">
              Pergunte pelo WhatsApp como estão seus orçamentos, clientes e contatos novos, ou peça um orçamento,
              como se falasse com um gerente. Ele só enxerga os dados da <strong>sua</strong> revenda.
            </p>
          </div>
        </div>

        {verificado && !trocando ? (
          <div className="space-y-3">
            <p className="text-sm text-green-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Seu celular {info.vinculo.telefone_mascarado} já está ligado.
              {oficial && <> É só mandar mensagem para <strong>{formatarNumero(oficial)}</strong>.</>}
            </p>
            <div className="flex gap-2 flex-wrap">
              {oficial && (
                <a href={`https://wa.me/${oficial}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">Abrir conversa com o Gerente</Button>
                </a>
              )}
              <Button size="sm" variant="outline" onClick={() => setTrocando(true)} disabled={busy}>Trocar de celular</Button>
              <Button size="sm" variant="ghost" onClick={desligar} disabled={busy}>Desligar</Button>
            </div>
          </div>
        ) : !codigo ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <p className="font-semibold">Passo 1 de 2: qual é o seu celular com WhatsApp?</p>
              <p className="text-gray-500">Use o celular que você leva com você. Coloque o DDD.</p>
            </div>
            <div className="flex gap-2 flex-wrap items-end">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Seu celular</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(37) 99999-0000"
                  inputMode="tel"
                  name="pf-celular-gerente"
                  autoComplete="off"
                  data-lpignore="true"
                  className="w-56"
                />
              </div>
              <Button onClick={gerarCodigo} disabled={busy || telefone.replace(/\D/g, "").length < 10}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                Continuar
              </Button>
              {trocando && <Button variant="ghost" onClick={() => setTrocando(false)}>Cancelar</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <p className="font-semibold">Passo 2 de 2: mande este código pelo WhatsApp</p>
              <p className="text-gray-500">
                Do celular que você informou, mande a mensagem abaixo para o WhatsApp do PlaceFit
                {oficial && <> (<strong>{formatarNumero(oficial)}</strong>)</>}. O código vale por 15 minutos.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-2xl font-bold tracking-widest bg-gray-100 rounded-lg px-4 py-2">{textoAtivar}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(textoAtivar); toast({ title: "Copiado" }); }}>
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {linkWhats && (
                <a href={linkWhats} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700 text-white">Abrir o WhatsApp com a mensagem pronta</Button>
                </a>
              )}
              <Button variant="ghost" onClick={() => setCodigo("")}>Voltar</Button>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Esperando sua mensagem… esta tela atualiza sozinha.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
