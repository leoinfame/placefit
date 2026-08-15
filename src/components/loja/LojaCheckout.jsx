import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { X, Loader2, CheckCircle2, Lock } from "lucide-react";
import { createStoreOrder } from "@/functions/createStoreOrder";
import { computeFreteLoja } from "@/utils/freteLoja";

const Field = ({ label, value, onChange, className = "", textarea }) => (
  <div className={className}>
    <label className="text-xs text-gray-500">{label}</label>
    {textarea ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" rows={2} />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
    )}
  </div>
);

const PayBtn = ({ active, onClick, label, primaryColor }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-lg border text-sm ${active ? "text-white" : "bg-white"}`} style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}>{label}</button>
);

export default function LojaCheckout({ open, onClose, config, cart, subtotal, primaryColor, sessao, slug, onLogin, onOrdered, onClear, embedTop, embedHeight }) {
  const [step, setStep] = useState("form");
  const [numero, setNumero] = useState("");
  const c = sessao?.cliente;
  const [form, setForm] = useState({
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    pagamento_metodo: config?.aceita_pix ? "pix" : "dinheiro",
    observacoes: "",
  });
  const [error, setError] = useState("");

  // Frete pela tabela MuscularFit: estado + peso total do carrinho.
  const pesoTotal = useMemo(() => cart.reduce((s, it) => s + (Number(it.product?.peso_kg) || 0) * it.quantidade, 0), [cart]);
  const freteCalc = useMemo(() => {
    if (!form.estado) return null;
    return computeFreteLoja(form.estado, pesoTotal, form.cidade);
  }, [form.estado, form.cidade, pesoTotal]);
  const totalCalc = subtotal + (freteCalc || 0);

  useEffect(() => {
    if (c) setForm((f) => ({
      ...f,
      cep: c.cep || "", logradouro: c.endereco || "", numero: c.numero || "",
      complemento: c.complemento || "", bairro: c.bairro || "", cidade: c.cidade || "", estado: c.estado || "",
    }));
  }, [c?.id]);

  if (!open) return null;
  const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const submit = async () => {
    setError("");
    if (!form.cep || !form.logradouro || !form.cidade || !form.estado) {
      setError("Preencha o endereço de entrega."); return;
    }
    setStep("loading");
    try {
      const itens = cart.map((it) => ({ sp_id: it.sp_id, quantidade: it.quantidade }));
      const res = await createStoreOrder({
        slug: config.slug,
        cliente_id: sessao.cliente.id,
        token: sessao.token,
        endereco: { cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado },
        itens, pagamento_metodo: form.pagamento_metodo, frete: freteCalc || 0, observacoes: form.observacoes,
      });
      setNumero(res.data?.numero_pedido || "");
      setStep("success");
      onClear();
      onOrdered?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Erro ao finalizar pedido");
      setStep("form");
    }
  };

  const close = () => { if (step !== "loading") { setStep("form"); onClose(); } };

  const embedded = embedTop != null && embedHeight != null;
  const backdropStyle = embedded ? { position: "absolute", top: embedTop, left: 0, right: 0, height: embedHeight } : undefined;

  return (
    <div className={embedded ? "bg-black/50 z-[60] flex items-center justify-center p-4" : "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"} style={backdropStyle}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{step === "success" ? "Pedido Confirmado!" : "Finalizar Compra"}</h3>
          <button onClick={close} disabled={step === "loading"}><X className="w-5 h-5" /></button>
        </div>

        {!sessao ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style={{ backgroundColor: primaryColor }}>
              <Lock className="w-7 h-7 text-white" />
            </div>
            <p className="font-semibold text-gray-900">Faça login para comprar</p>
            <p className="text-sm text-gray-400 mt-1 mb-5">Você precisa de uma conta para finalizar a compra e acompanhar seu pedido.</p>
            <Link to={`/loja/${slug}/conta`} onClick={onLogin} className="inline-block text-white font-semibold px-6 py-2.5 rounded-lg" style={{ backgroundColor: primaryColor }}>
              Entrar / Criar conta
            </Link>
          </div>
        ) : step === "success" ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="font-semibold text-lg">Obrigado pela sua compra!</p>
            <p className="text-gray-500 mt-1">Pedido <span className="font-bold">{numero}</span> registrado.</p>
            <p className="text-sm text-gray-400 mt-2">Acompanhe o status do seu pedido em "Minha Conta".</p>
            <Link to={`/loja/${slug}/conta`} onClick={close} className="mt-6 inline-block text-white font-semibold px-6 py-2 rounded-lg" style={{ backgroundColor: primaryColor }}>Ver meus pedidos</Link>
          </div>
        ) : step === "loading" ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: primaryColor }} /><p className="mt-3 text-gray-500">Processando pedido...</p></div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 text-sm">
              <span className="text-gray-400">Comprando como:</span>
              <span className="font-medium text-gray-900">{c?.nome}</span>
              <span className="text-gray-400 text-xs">({c?.email})</span>
            </div>
            <p className="font-semibold text-sm pt-2">Endereço de Entrega</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP*" value={form.cep} onChange={(v) => setForm({ ...form, cep: v })} />
              <Field label="Logradouro*" value={form.logradouro} onChange={(v) => setForm({ ...form, logradouro: v })} className="col-span-2" />
              <Field label="Número" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} />
              <Field label="Complemento" value={form.complemento} onChange={(v) => setForm({ ...form, complemento: v })} className="col-span-2" />
              <Field label="Bairro" value={form.bairro} onChange={(v) => setForm({ ...form, bairro: v })} />
              <Field label="Cidade*" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
              <Field label="UF*" value={form.estado} onChange={(v) => setForm({ ...form, estado: v.toUpperCase().slice(0, 2) })} />
            </div>
            <p className="font-semibold text-sm pt-2">Pagamento</p>
            <div className="flex flex-wrap gap-2">
              {config.aceita_pix && <PayBtn active={form.pagamento_metodo === "pix"} onClick={() => setForm({ ...form, pagamento_metodo: "pix" })} label="PIX" primaryColor={primaryColor} />}
              {config.aceita_cartao && <PayBtn active={form.pagamento_metodo === "cartao"} onClick={() => setForm({ ...form, pagamento_metodo: "cartao" })} label="Cartão" primaryColor={primaryColor} />}
              {config.aceita_boleto && <PayBtn active={form.pagamento_metodo === "boleto"} onClick={() => setForm({ ...form, pagamento_metodo: "boleto" })} label="Boleto" primaryColor={primaryColor} />}
              {config.aceita_dinheiro && <PayBtn active={form.pagamento_metodo === "dinheiro"} onClick={() => setForm({ ...form, pagamento_metodo: "dinheiro" })} label="Dinheiro na entrega" primaryColor={primaryColor} />}
            </div>
            <Field label="Observações" value={form.observacoes} onChange={(v) => setForm({ ...form, observacoes: v })} textarea />
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>R$ {fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>Frete</span><span>{freteCalc == null ? "Informe o estado" : "R$ " + fmt(freteCalc)}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>R$ {fmt(totalCalc)}</span></div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button onClick={submit} className="w-full text-white font-semibold py-3 rounded-lg" style={{ backgroundColor: primaryColor }}>Confirmar Pedido</button>
          </div>
        )}
      </div>
    </div>
  );
}