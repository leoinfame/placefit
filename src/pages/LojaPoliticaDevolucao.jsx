import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Store, ArrowLeft } from "lucide-react";
import { getStoreData } from "@/functions/getStoreData";

export default function LojaPoliticaDevolucao() {
  const { slug } = useParams();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getStoreData({ slug });
        const data = res.data || res;
        if (mounted) setConfig(data.config);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.error || "Loja não encontrada");
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [slug]);

  const primary = config?.cor_primaria || "#1e40af";
  const nomeLoja = config?.nome_loja || "nossa loja";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Store className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm" style={{ backgroundColor: primary }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {config?.logo_url ? (
            <img src={config.logo_url} className="h-10 w-10 rounded-lg object-cover" alt={nomeLoja} />
          ) : (
            <Store className="w-8 h-8 text-white" />
          )}
          <span className="text-white font-semibold">{nomeLoja}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link to={`/loja/${slug}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Política de Devolução e Troca</h1>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
          <p>
            Na {nomeLoja} você pode solicitar a devolução ou troca de qualquer produto em até{" "}
            <strong>15 (quinze) dias corridos</strong> a partir da data de recebimento, conforme o
            direito de arrependimento previsto no Código de Defesa do Consumidor (art. 49) para
            compras realizadas fora do estabelecimento comercial, ou por defeito/não conformidade do
            produto.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-6">Prazo</h2>
          <p>
            O prazo para solicitar a devolução é de <strong>15 dias</strong> contados a partir do
            recebimento do produto. Após esse período, a devolução poderá ser analisada apenas em
            casos de defeito de fabricação, conforme garantia do fornecedor.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-6">Custo do frete de devolução</h2>
          <p>
            O <strong>frete de devolução é de responsabilidade do cliente</strong>, exceto nos casos
            em que o produto apresente defeito de fabricação ou tenha sido enviado incorretamente,
            situações em que o custo do frete de devolução será assumido pela loja.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-6">Condições para devolução</h2>
          <p>
            Para que a devolução seja aceita, o produto deve ser devolvido em sua embalagem original,
            sem sinais de uso, acompanhado da nota fiscal de compra e de todos os acessórios e manuais
            que o acompanham.
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-6">Como solicitar</h2>
          <p>
            Para solicitar uma devolução ou troca, entre em contato conosco
            {config?.whatsapp_contato ? <> pelo WhatsApp <strong>{config.whatsapp_contato}</strong></> : ""}
            {" "}informando o número do pedido e o motivo da solicitação. Após a análise, enviaremos as
            instruções para o envio do produto.
          </p>
        </div>
      </main>

      <footer className="border-t mt-8 py-6 text-center text-xs text-gray-400">
        <p>Powered by PlaceFit</p>
      </footer>
    </div>
  );
}
