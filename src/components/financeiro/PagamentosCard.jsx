import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditCard } from "lucide-react";

// Pagamento pela InfinitePay (so admin). Credenciais ficam nos secrets do app.
export default function PagamentosCard() {
  const [config, setConfig] = useState(null);
  const [faltando, setFaltando] = useState([]);
  const [cobrancas, setCobrancas] = useState([]);
  const [valor, setValor] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [configs, status, lista] = await Promise.all([
          base44.entities.ConfigPagamento.filter({ provider: "infinitepay" }),
          base44.functions.invoke("statusPagamentoInfinitePay", {}),
          base44.entities.CobrancaInfinitePay.list("-created_date", 20),
        ]);
        setConfig(configs[0] || { provider: "infinitepay", infinite_tag: "placefit", taxa_parcelamento: "loja", parcelas_sem_juros_assumidas: 12, desconto_pix_pct: 10, ativo: false });
        setFaltando(status?.data?.faltando || []);
        setCobrancas(lista);
      } catch (e) {
        setMsg("Não foi possível carregar os pagamentos.");
      }
    })();
  }, []);

  if (!config) return msg ? <p className="text-sm text-red-600">{msg}</p> : null;

  const set = (campo, v) => setConfig((c) => ({ ...c, [campo]: v }));

  const salvar = async () => {
    const tag = String(config.infinite_tag || "").trim().replace(/^\$/, "");
    if (config.ativo && (faltando.length > 0 || !tag)) {
      setMsg(`Para ligar, falta: ${[...faltando, ...(tag ? [] : ["InfiniteTag"])].join(", ")}`);
      return;
    }
    try {
      const dados = {
        provider: "infinitepay",
        infinite_tag: tag,
        taxa_parcelamento: "loja",
        parcelas_sem_juros_assumidas: Math.min(12, Math.max(0, Number(config.parcelas_sem_juros_assumidas) || 0)),
        desconto_pix_pct: Math.min(99, Math.max(0, Number(config.desconto_pix_pct) || 0)),
        email_aviso: String(config.email_aviso || "").trim(),
        ativo: !!config.ativo,
      };
      const salvo = config.id
        ? await base44.entities.ConfigPagamento.update(config.id, dados)
        : await base44.entities.ConfigPagamento.create(dados);
      setConfig(salvo);
      setMsg("Configuração salva.");
    } catch (e) {
      setMsg("Não foi possível salvar.");
    }
  };

  const gerar = async () => {
    setLink("");
    setMsg("");
    try {
      const r = await base44.functions.invoke("criarLinkPagamentoInfinitePay", { valor: Number(valor.replace(",", ".")), descricao: "Teste de cobranca PlaceFit" });
      setLink(r.data.checkout_url);
    } catch (e) {
      setMsg(e?.response?.data?.error || "Não foi possível gerar o link.");
    }
  };

  const testarAviso = async () => {
    setMsg("Enviando aviso...");
    try {
      const { data } = await base44.functions.invoke("testarAvisoVenda", {});
      setMsg(`E-mails enviados: ${data.email}. WhatsApp: ${data.whatsapp ? "enviado" : "não enviado"}. ${(data.erros || []).join(" | ")}`);
    } catch {
      setMsg("Não foi possível enviar o aviso.");
    }
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Pagamentos (InfinitePay)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          {faltando.length === 0 ? "Credenciais configuradas." : `Falta nos secrets do app: ${faltando.join(", ")}`}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>InfiniteTag (sem $)</Label><Input value={config.infinite_tag || ""} onChange={(e) => set("infinite_tag", e.target.value)} /></div>
          <div><Label>Parcelas sem juros</Label><Input type="number" min={0} max={12} value={config.parcelas_sem_juros_assumidas ?? 0} onChange={(e) => set("parcelas_sem_juros_assumidas", e.target.value)} /></div>
          <div><Label>Desconto no Pix (%)</Label><Input type="number" min={0} max={99} value={config.desconto_pix_pct ?? 0} onChange={(e) => set("desconto_pix_pct", e.target.value)} /></div>
        </div>
        <div><Label>E-mail que recebe o aviso de venda</Label><Input type="email" value={config.email_aviso || ""} onChange={(e) => set("email_aviso", e.target.value)} /></div>
        <div className="flex items-center gap-3"><Switch checked={!!config.ativo} onCheckedChange={(v) => set("ativo", v)} /><span className="text-sm">Pagamento ligado no site</span></div>
        <Button onClick={salvar}>Salvar</Button>
        <div className="flex flex-col md:flex-row gap-2 border-t pt-4">
          <Input className="md:max-w-[160px]" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Button variant="outline" onClick={gerar}>Gerar link de teste</Button>
          <Button variant="outline" onClick={testarAviso}>Testar aviso de venda</Button>
        </div>
        {link && <a className="text-sm text-green-700 underline break-all" href={link} target="_blank" rel="noopener noreferrer">{link}</a>}
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
        <div className="border-t pt-4 space-y-1">
          <p className="text-sm font-semibold">Últimas cobranças</p>
          {cobrancas.length === 0 && <p className="text-sm text-gray-500">Nenhuma ainda.</p>}
          {cobrancas.map((c) => (
            <p key={c.id} className="text-sm text-gray-700">
              {new Date(c.created_date).toLocaleDateString("pt-BR")} · {c.cliente_nome || c.descricao} · R$ {Number(c.paid_amount || c.valor).toFixed(2)} · {c.status}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
