import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Copy, Check, RefreshCw, ExternalLink, ImageOff, MessageCircle, Loader2, AlertTriangle,
} from "lucide-react";

const fmtData = (iso) => {
  if (!iso) return "nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

const gerarToken = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export default function WhatsappCatalogo({ config, onSaved }) {
  const { toast } = useToast();
  const [feedBase, setFeedBase] = useState("");
  const [copied, setCopied] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("lojaFeedMeta", { info: 1 })
      .then((r) => setFeedBase(r?.data?.feed_base_url || r?.feed_base_url || ""))
      .catch(() => setFeedBase(""));
  }, []);

  if (!config?.slug) {
    return (
      <p className="text-gray-500 text-sm">
        Salve sua loja (defina o slug) antes de ativar o catálogo do WhatsApp.
      </p>
    );
  }

  const ativo = !!config.wa_feed_token;
  const feedUrl = ativo && feedBase
    ? `${feedBase}?slug=${encodeURIComponent(config.slug)}&token=${encodeURIComponent(config.wa_feed_token)}`
    : "";

  const ativar = async () => {
    setAtivando(true);
    try {
      await base44.entities.LojaConfig.update(config.id, {
        wa_feed_token: gerarToken(),
        wa_sync_ativo: true,
      });
      toast({ title: "Catálogo do WhatsApp ativado!", description: "Agora copie a URL do feed." });
      onSaved?.();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setAtivando(false);
  };

  const togglePausa = async (ligado) => {
    try {
      await base44.entities.LojaConfig.update(config.id, { wa_sync_ativo: ligado });
      onSaved?.();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const copiar = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testar = async () => {
    setTestando(true);
    setTeste(null);
    try {
      const res = await fetch(`${feedUrl}&format=json`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setTeste(json.stats);
      onSaved?.();
    } catch (e) {
      toast({ title: "O feed não respondeu", description: e.message, variant: "destructive" });
    }
    setTestando(false);
  };

  const semFoto = teste?.sem_foto ?? config.wa_itens_sem_foto ?? 0;
  const publicados = teste?.publicados ?? config.wa_itens_publicados ?? 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 bg-emerald-50/60 border-emerald-200">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900">
              Seu catálogo do WhatsApp se atualiza sozinho
            </p>
            <p>
              É a mesma lista da sua loja online: todo produto que você deixa{" "}
              <strong>disponível</strong> em Meus Produtos entra no catálogo, e o que você desativa
              sai. Você configura a URL abaixo <strong>uma única vez</strong> no Gerenciador de
              Comércio da Meta e não mexe mais — preço, promoção e disponibilidade passam a ir
              sozinhos, de hora em hora.
            </p>
          </div>
        </div>
      </div>

      {!ativo ? (
        <Button onClick={ativar} disabled={ativando}>
          {ativando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Ativar catálogo do WhatsApp
        </Button>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">URL do feed (cole na Meta)</label>
              <div className="flex items-center gap-2 text-sm">
                <span className={config.wa_sync_ativo === false ? "text-gray-400" : "text-emerald-600"}>
                  {config.wa_sync_ativo === false ? "Pausado" : "Sincronizando"}
                </span>
                <Switch
                  checked={config.wa_sync_ativo !== false}
                  onCheckedChange={togglePausa}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={feedUrl || "carregando..."}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-md border px-3 py-2 text-xs font-mono bg-gray-50"
              />
              <Button variant="outline" onClick={copiar} disabled={!feedUrl}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="outline" onClick={testar} disabled={!feedUrl || testando}>
                {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Essa URL é secreta — quem tem ela vê sua tabela de preços de venda. Não publique.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-3">
              <p className="text-2xl font-bold">{publicados}</p>
              <p className="text-xs text-gray-500">produtos no catálogo</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-2xl font-bold">{semFoto}</p>
              <p className="text-xs text-gray-500">de fora por falta de foto</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-sm font-bold">{fmtData(config.wa_ultima_sync)}</p>
              <p className="text-xs text-gray-500">última busca da Meta</p>
            </div>
          </div>

          {semFoto > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-900">
              <ImageOff className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                <strong>{semFoto} produtos ativos ficaram de fora</strong> porque o cadastro ainda
                não tem foto — a Meta recusa item sem imagem. Assim que a foto entrar no catálogo
                PlaceFit, eles aparecem sozinhos no WhatsApp.
              </p>
            </div>
          )}

          {publicados === 0 && config.wa_ultima_sync && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2 text-sm text-red-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Nenhum produto saiu no último feed. Confira se há produtos marcados como
                disponíveis em Meus Produtos e se eles têm preço.
              </p>
            </div>
          )}

          <div className="rounded-xl border p-4 space-y-2 text-sm">
            <p className="font-semibold">Como conectar (uma vez só)</p>
            <ol className="list-decimal ml-5 space-y-1 text-gray-700">
              <li>
                Abra o{" "}
                <a
                  href="https://business.facebook.com/commerce"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Gerenciador de Comércio da Meta <ExternalLink className="w-3 h-3" />
                </a>{" "}
                e escolha o catálogo ligado ao seu WhatsApp Business.
              </li>
              <li>Vá em <strong>Catálogo &gt; Fontes de dados &gt; Adicionar itens</strong>.</li>
              <li>
                Escolha <strong>Usar um feed agendado</strong> (não "enviar arquivo") e cole a URL
                acima.
              </li>
              <li>
                Defina a frequência como <strong>De hora em hora</strong>, moeda{" "}
                <strong>BRL</strong> e país <strong>Brasil</strong>.
              </li>
              <li>Salve. A primeira carga leva alguns minutos; depois é automático.</li>
            </ol>
            <p className="text-xs text-gray-500 pt-1">
              O catálogo precisa estar conectado ao seu número no WhatsApp Business para os produtos
              aparecerem na conversa (WhatsApp &gt; Configurações da empresa &gt; Catálogo).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
