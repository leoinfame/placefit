import React, { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { createStoreOrder } from "@/functions/createStoreOrder";

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

export default function LojaCheckout({ open, onClose, config, cart, subtotal, frete, total, primaryColor, onClear }) {
  const [step, setStep] = useState("form");
  const [numero, setNumero] = useState("");
  const [form, setForm] = useState({
    nome: "", email: "", cpf: "", telefone: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    pagamento_metodo: config?.aceita_pix ? "pix" : "dinheiro",
    observacoes: "",
  });
  const [error, setError] = useState("");

  if (!open) return null;
  const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const submit = async () => {
    setError("");
    if (!form.nome || !form.email || !form.cep || !form.logradouro || !form.cidade || !form.estado) {
      setError("Preencha nome, e-mail e endereço de entrega."); return;
    }
    setStep("loading");
    try {
      const itens = cart.map((it) => ({ sp_id: it.sp_id, quantidade: it.quantidade }));
      const res = await createStoreOrder({
        slug: config.slug,
        cliente: { nome: form.nome, email: form.email, cpf: form.cpf, telefone: form.telefone },
        endereco: { cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado },
        itens, pagamento_metodo: form.pagamento_metodo, frete, observacoes: form.observacoes,
      });
      setNumero(res.data?.numero_pedido || "");
      setStep("success");
      onClear();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Erro ao finalizar pedido");
      setStep("form");
    }
  };

  const close = () => { if (step !== "loading") { setStep("form"); onClose(); } };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{step === "success" ? "Pedido Confirmado!" : "Finalizar Compra"}</h3>
          <button onClick={close} disabled={step === "loading"}><X className="w-5 h-5" /></button>
        </div>
        {step === "success" ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="font-semibold text-lg">Obrigado pela sua compra!</p>
            <p className="text-gray-500 mt-1">Pedido <span className="font-bold">{numero}</span> registrado.</p>
            <p className="text-sm text-gray-400 mt-2">Você receberá o contato do vendedor em breve para confirmação e pagamento.</p>
            <button onClick={close} className="mt-6 text-white font-semibold px-6 py-2 rounded-lg" style={{ backgroundColor: primaryColor }}>Fechar</button>
          </div>
        ) : step === "loading" ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: primaryColor }} /><p className="mt-3 text-gray-500">Processando pedido...</p></div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome*" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} className="col-span-2" />
              <Field label="E-mail*" value={form.email} onChange={(v) => setForm({ ...form, email: v })} className="col-span-2" />
              <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
              <Field label="Telefone/WhatsApp" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
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
              <div className="flex justify-between"><span>Frete</span><span>{frete === 0 ? "Grátis" : "R$ " + fmt(frete)}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>R$ {fmt(total)}</span></div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button onClick={submit} className="w-full text-white font-semibold py-3 rounded-lg" style={{ backgroundColor: primaryColor }}>Confirmar Pedido</button>
          </div>
        )}
      </div>
    </div>
  );
}