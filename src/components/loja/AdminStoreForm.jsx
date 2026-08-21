import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Check, AlertTriangle } from "lucide-react";

export default function AdminStoreForm({ resellers, config, onSaved, lockReseller }) {
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({ ...config });
    } else {
      setForm({
        revendedor_id: lockReseller ? (resellers[0]?.id || "") : "",
        slug: "", nome_loja: "",
        cor_primaria: "#1e40af", cor_secundaria: "#059669", descricao: "",
        frete_fixo_valor: 0, frete_gratis_valor: 0,
        aceita_pix: true, aceita_cartao: false, aceita_boleto: false, aceita_dinheiro: false,
        ativo: false,
        dominio_loja: "",
      });
    }
  }, [config]);

  if (!form) return null;

  const save = async () => {
    if (!form.revendedor_id || !form.slug || !form.nome_loja) { toast({ title: "Preencha slug e nome da loja", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { ...form, frete_fixo_valor: Number(form.frete_fixo_valor) || 0, frete_gratis_valor: Number(form.frete_gratis_valor) || 0, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "") };
      if (form.id) await base44.entities.LojaConfig.update(form.id, payload);
      else await base44.entities.LojaConfig.create(payload);
      toast({ title: "Loja salva!" });
      onSaved();
    } catch (e) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  const lojaOrigin = form.dominio_loja ? form.dominio_loja.replace(/\/+$/, "") : window.location.origin;
  const embed = form.id ? `<iframe src="${lojaOrigin}/loja/${form.slug}" style="width:100%;min-height:700px;border:0" allow="payment"></iframe>` : "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {!lockReseller && (
          <div>
            <Label>Revendedor*</Label>
            <Select value={form.revendedor_id} onValueChange={(v) => setForm({ ...form, revendedor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o revendedor" /></SelectTrigger>
              <SelectContent>{resellers.map((r) => <SelectItem key={r.id} value={r.id}>{r.empresa || r.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div><Label>Slug (URL)*</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="fitness-suply" /></div>
        <div className="md:col-span-2"><Label>Nome da Loja*</Label><Input value={form.nome_loja} onChange={(e) => setForm({ ...form, nome_loja: e.target.value })} /></div>
        <div><Label>Cor Primária</Label><Input type="color" value={form.cor_primaria} onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} /></div>
        <div><Label>Cor Secundária</Label><Input type="color" value={form.cor_secundaria} onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} /></div>
        <div><Label>Frete Fixo (R$)</Label><Input type="number" value={form.frete_fixo_valor} onChange={(e) => setForm({ ...form, frete_fixo_valor: e.target.value })} /></div>
        <div><Label>Frete Grátis acima de (R$)</Label><Input type="number" value={form.frete_gratis_valor} onChange={(e) => setForm({ ...form, frete_gratis_valor: e.target.value })} /></div>
      </div>

      {/* Dominio proprio — obrigatorio para Google Merchant Center e Meta */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
        <div>
          <Label className="font-semibold">Domínio próprio da loja (para Google e Meta)</Label>
          <Input
            value={form.dominio_loja || ""}
            onChange={(e) => setForm({ ...form, dominio_loja: e.target.value })}
            placeholder="https://loja.seudominio.com.br"
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            O endereço público onde a loja responde no domínio do revendedor.{" "}
            <strong>Obrigatório para Google Merchant Center e catálogo da Meta</strong> — ambos
            exigem que o link do produto aponte para um domínio verificado pelo lojista. Sem isso,
            o feed funciona mas os itens são reprovados por landing page não reivindicada.
          </p>
        </div>
        <div className="text-xs text-gray-700 space-y-1 border-t border-blue-100 pt-2">
          <p className="font-semibold">Como configurar (uma vez só):</p>
          <ol className="list-decimal ml-5 space-y-0.5">
            <li>No painel do seu domínio, crie um registro <strong>CNAME</strong> apontando o subdomínio (ex: <code>loja</code>) para <code>base44.onrender.com</code>.</li>
            <li>Avise o administrador da PlaceFit para adicionar o domínio em Dashboard → Domains da plataforma.</li>
            <li>Após a verificação (SSL automático), preencha este campo com o endereço completo (ex: <code>https://loja.seudominio.com.br</code>).</li>
          </ol>
        </div>
        {form.id && form.dominio_loja && (
          <div className="text-xs text-emerald-700 flex items-center gap-1.5 border-t border-blue-100 pt-2">
            <Check className="w-3.5 h-3.5" />
            Link dos produtos no feed: <code className="bg-emerald-50 px-1.5 py-0.5 rounded">{form.dominio_loja.replace(/\/+$/, "")}/loja/{form.slug}/produto/...</code>
          </div>
        )}
        {form.id && !form.dominio_loja && (
          <div className="text-xs text-amber-700 flex items-start gap-1.5 border-t border-blue-100 pt-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Sem domínio próprio, os links saem como <code>placefit.base44.app/loja/{form.slug}</code> e o Google/Meta vão reprovar os produtos.
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 -mt-2">A logomarca e o WhatsApp exibidos na loja vêm do perfil do revendedor.</p>
      <div className="flex flex-wrap gap-4">
        {["aceita_pix", "aceita_cartao", "aceita_boleto", "aceita_dinheiro", "ativo"].map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm capitalize">
            <Checkbox checked={!!form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} /> {k.replace("aceita_", "").replace("_", " ")}{k === "ativo" ? " (publicada)" : ""}
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar Loja"}</Button>

      {embed && (
        <div className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono relative">
          <button onClick={() => { navigator.clipboard.writeText(embed); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="absolute top-2 right-2 text-white">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">{embed}</pre>
          <p className="text-gray-400 mt-2 font-sans">Cole este código no seu site (WordPress etc.) para exibir a loja com seus produtos.</p>
        </div>
      )}
    </div>
  );
}