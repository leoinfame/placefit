import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  ShoppingBag,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

const fmtData = (iso) => {
  if (!iso) return "nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

export default function MercadoLivreExport({ config, onSaved }) {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Detectar callback do OAuth na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ml_connected")) {
      toast({ title: "Mercado Livre conectado!", description: "Sua conta foi vinculada com sucesso." });
      window.history.replaceState({}, "", window.location.pathname);
      onSaved?.();
    }
    if (params.get("ml_error")) {
      toast({ title: "Erro ao conectar", description: "Não foi possível conectar sua conta do ML.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (config?.ml_access_token) {
      loadProducts();
    } else {
      setLoading(false);
    }
  }, [config?.ml_access_token]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me();
      const sps = await base44.entities.SupplierProduct.filter(
        { supplier_id: u.id },
        "-created_date",
        500,
      );
      const productIds = [...new Set(sps.map((sp) => sp.product_id).filter(Boolean))];
      const templates = productIds.length
        ? await base44.entities.ProductTemplate.filter(
            { id: { $in: productIds } },
            "-created_date",
            500,
          )
        : [];
      const tplById = {};
      for (const t of templates) tplById[t.id] = t;

      const available = sps
        .filter((sp) => sp.disponivel !== false && sp.product_id)
        .map((sp) => ({ ...sp, template: tplById[sp.product_id] }))
        .filter((sp) => sp.template && sp.template.ativo !== false);

      setProducts(available);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar produtos", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const u = await base44.auth.me();
      const res = await base44.functions.invoke("mlAuth", {
        info: 1,
        revendedor_id: u.id,
        slug: config?.slug || "",
      });
      const authUrl = res?.auth_url || res?.data?.auth_url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error("URL de autorização não recebida");
      }
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setConnecting(false);
  };

  const disconnect = async () => {
    try {
      await base44.entities.LojaConfig.update(config.id, {
        ml_access_token: "",
        ml_refresh_token: "",
        ml_expires_at: "",
        ml_user_id: "",
        ml_nickname: "",
      });
      toast({ title: "Mercado Livre desconectado" });
      onSaved?.();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const toggleSelect = (sp_id) => {
    const next = new Set(selected);
    if (next.has(sp_id)) next.delete(sp_id);
    else next.add(sp_id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(products.map((p) => p.id)));
  const selectNone = () => setSelected(new Set());

  const exportar = async () => {
    if (selected.size === 0) {
      toast({ title: "Selecione ao menos um produto", variant: "destructive" });
      return;
    }
    setExporting(true);
    setResults(null);
    try {
      const u = await base44.auth.me();
      const res = await base44.functions.invoke("mlExportarProdutos", {
        revendedor_id: u.id,
        sp_ids: [...selected],
      });
      if (res?.error) throw new Error(res.error);
      setResults(res);
      if (res.sucessos > 0) {
        toast({
          title: `${res.sucessos} produto${res.sucessos !== 1 ? "s" : ""} exportado${res.sucessos !== 1 ? "s" : ""}!`,
          description: res.falhas > 0 ? `${res.falhas} falha${res.falhas !== 1 ? "s" : ""}` : "Tudo certo!",
        });
        onSaved?.();
      } else {
        toast({ title: "Nenhum produto foi exportado", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na exportação", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  };

  if (!config?.slug) {
    return (
      <p className="text-gray-500 text-sm">
        Salve sua loja (defina o slug) antes de conectar o Mercado Livre.
      </p>
    );
  }

  const connected = !!config.ml_access_token;

  return (
    <div className="space-y-5">
      {/* Status da conexao */}
      <div
        className={`rounded-xl border p-4 ${
          connected ? "bg-yellow-50/60 border-yellow-200" : "bg-gray-50 border-gray-200"
        }`}
      >
        <div className="flex items-start gap-3">
          <ShoppingBag
            className={`w-5 h-5 mt-0.5 shrink-0 ${connected ? "text-yellow-600" : "text-gray-400"}`}
          />
          <div className="flex-1">
            <p className="font-semibold text-gray-900">
              {connected
                ? `Conectado: ${config.ml_nickname || "Conta ML"}`
                : "Mercado Livre não conectado"}
            </p>
            {connected ? (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Desconectar
                </Button>
                {config.ml_ultima_exportacao && (
                  <span className="text-xs text-gray-500">
                    Última exportação: {fmtData(config.ml_ultima_exportacao)} •{" "}
                    {config.ml_itens_exportados || 0} itens
                  </span>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mt-1">
                  Conecte sua conta do Mercado Livre para exportar seus produtos em lote,
                  com categoria e preço preenchidos automaticamente.
                </p>
                <Button
                  onClick={connect}
                  disabled={connecting}
                  className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 mr-2" />
                  )}
                  Conectar Mercado Livre
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {connected && (
        <>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{products.length} produtos disponíveis</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{selected.size} selecionados</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {products.length === 0 ? (
                    <p className="p-4 text-center text-gray-500 text-sm">
                      Nenhum produto disponível. Adicione produtos em "Meus Produtos".
                    </p>
                  ) : (
                    products.map((sp) => (
                      <label
                        key={sp.id}
                        className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selected.has(sp.id)}
                          onCheckedChange={() => toggleSelect(sp.id)}
                        />
                        {sp.template?.foto ? (
                          <img
                            src={sp.template.foto}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {sp.template?.nome || "?"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {sp.template?.cod} • {sp.template?.categoria}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">
                          R$ {Number(sp.preco || 0).toFixed(2)}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <Button
                onClick={exportar}
                disabled={exporting || selected.size === 0}
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingBag className="w-4 h-4 mr-2" />
                )}
                {exporting
                  ? "Exportando..."
                  : `Exportar ${selected.size} produto${selected.size !== 1 ? "s" : ""} para o ML`}
              </Button>

              {/* Resultados */}
              {results && (
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">{results.sucessos} exportados</span>
                    </div>
                    {results.falhas > 0 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <X className="w-4 h-4" />
                        <span className="font-medium">{results.falhas} falhas</span>
                      </div>
                    )}
                  </div>
                  {results.results?.filter((r) => !r.success).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-700">Falhas:</p>
                      {results.results
                        .filter((r) => !r.success)
                        .map((r, i) => (
                          <div key={i} className="text-xs text-red-600 flex gap-2">
                            <X className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>
                              <strong>{r.nome}</strong>: {r.error}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                  {results.results?.filter((r) => r.success).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-700">Anúncios criados:</p>
                      {results.results
                        .filter((r) => r.success)
                        .map((r, i) => (
                          <a
                            key={i}
                            href={r.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {r.nome} <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Aviso explicativo */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm text-gray-700">
                <p className="font-semibold mb-1">Como funciona</p>
                <ul className="list-disc ml-5 space-y-0.5 text-gray-600">
                  <li>
                    Selecione os produtos e clique em "Exportar". O sistema cria um anúncio
                    no seu Mercado Livre para cada produto selecionado.
                  </li>
                  <li>
                    Categoria, preço, foto e descrição são preenchidos automaticamente a
                    partir do seu cadastro PlaceFit.
                  </li>
                  <li>
                    Anúncios são criados como <strong>Novo, Clássico, sem frete grátis</strong>.
                    Você pode editar cada anúncio no ML depois.
                  </li>
                  <li>Produtos sem foto (HTTPS) ou sem preço não são exportados.</li>
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}