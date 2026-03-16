import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLogoColors } from "@/components/export/useLogoColors";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dumbbell,
  Phone,
  Mail,
  Globe,
  MapPin,
  Download,
  AlertCircle
} from "lucide-react";

export default function PublicTableFabricante() {
  const [fabricante, setFabricante] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const colors = useLogoColors(fabricante?.logomarca);

  useEffect(() => {
    loadTableData();
  }, []);

  const loadTableData = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fabricanteId = urlParams.get('fabricante');

      if (!fabricanteId) {
        setError("Link inválido. Fabricante não encontrado.");
        setLoading(false);
        return;
      }

      const users = await base44.entities.User.filter({ id: fabricanteId });
      if (users.length === 0) {
        setError("Fabricante não encontrado.");
        setLoading(false);
        return;
      }

      const fabricanteData = users[0];
      setFabricante(fabricanteData);

      const allProducts = await base44.entities.Product.filter({ ativo: true });
      const fabricanteProducts = allProducts.filter(
        p => p.fabricante_id === fabricanteId && p.aprovado_produto === true && p.preco_fabricante > 0
      );

      setProducts(fabricanteProducts);
    } catch (err) {
      setError("Erro ao carregar tabela. Tente novamente.");
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  const c = colors || {
    primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
    light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
  };

  // Agrupar por categoria
  const categorias = {};
  products.forEach(p => {
    const cat = p.categoria || 'Outros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(p);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto">
            <Dumbbell className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="animate-pulse text-gray-600">Carregando tabela...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-full { page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header PlaceFit */}
        <div className="text-center mb-6 no-print">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            PlaceFit
          </h1>
          <p className="text-gray-600">Plataforma de Fabricantes</p>
        </div>

        {/* Botão Impressão */}
        <div className="flex justify-end no-print">
          <Button
            onClick={handlePrint}
            style={{ background: `linear-gradient(90deg, ${c.primaryDark}, ${c.primary})` }}
            className="text-white hover:opacity-90"
          >
            <Download className="w-4 h-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Card Principal */}
        <Card className="bg-white shadow-2xl border-0 print-full">
          <CardContent className="p-0">
            {/* Header da empresa - banner com cores da logo */}
            <div
              className="rounded-t-lg p-6"
              style={{ background: `linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 60%, ${c.secondary} 100%)` }}
            >
              <div className="flex items-center gap-5">
                {fabricante.logomarca ? (
                  <img
                    src={fabricante.logomarca}
                    alt="Logo"
                    className="w-16 h-16 object-contain bg-white rounded-lg p-1.5 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    🏭
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: c.light }}>
                    PlaceFit — Fabricante
                  </p>
                  <h2 className="text-xl md:text-2xl font-bold truncate" style={{ color: c.textOnPrimary }}>
                    {fabricante.empresa || fabricante.full_name}
                  </h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {fabricante.whatsapp && (
                      <span className="text-xs flex items-center gap-1" style={{ color: c.light }}>
                        <Phone className="w-3 h-3" />{fabricante.whatsapp}
                      </span>
                    )}
                    {fabricante.email && (
                      <span className="text-xs flex items-center gap-1" style={{ color: c.light }}>
                        <Mail className="w-3 h-3" />{fabricante.email}
                      </span>
                    )}
                    {fabricante.endereco && (
                      <span className="text-xs flex items-center gap-1" style={{ color: c.light }}>
                        <MapPin className="w-3 h-3" />{fabricante.endereco}
                      </span>
                    )}
                    {fabricante.site && (
                      <span className="text-xs flex items-center gap-1" style={{ color: c.light }}>
                        <Globe className="w-3 h-3" />{fabricante.site.replace(/https?:\/\//, '')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textOnPrimary }}>
                    Tabela de<br />Preços Oficial
                  </p>
                  <p className="text-xs mt-1" style={{ color: c.light }}>
                    📅 {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 border-b" style={{ borderColor: c.lightBorder }}>
              <div className="p-4 text-center border-r" style={{ borderColor: c.lightBorder }}>
                <div className="text-2xl font-bold" style={{ color: c.textAccent }}>{products.length}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Produtos</div>
              </div>
              <div className="p-4 text-center border-r" style={{ borderColor: c.lightBorder }}>
                <div className="text-2xl font-bold" style={{ color: c.textAccent }}>{Object.keys(categorias).length}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Categorias</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-base font-bold" style={{ color: c.textAccent }}>{new Date().toLocaleDateString('pt-BR')}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Atualizado em</div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {products.length > 0 ? (
                Object.entries(categorias).map(([cat, itens]) => (
                  <div key={cat} className="rounded-lg overflow-hidden border" style={{ borderColor: c.lightBorder }}>
                    <div
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ background: `linear-gradient(90deg, ${c.primaryDark} 0%, ${c.primary} 100%)` }}
                    >
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: c.textOnPrimary }}>
                        {cat}
                      </span>
                      <span className="text-xs" style={{ color: c.light }}>
                        {itens.length} produto{itens.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-gray-200">
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide w-20" style={{color: '#1e293b !important'}}>Código</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{color: '#1e293b !important'}}>Produto</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide w-24 hidden md:table-cell" style={{color: '#1e293b !important'}}>Espec.</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide w-16" style={{color: '#1e293b !important'}}>Und.</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide w-28" style={{color: '#1e293b !important'}}>Preço</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((item, i) => (
                            <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap overflow-hidden max-w-[80px]" style={{ textOverflow: 'ellipsis' }}>
                                {item.cod || '—'}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap overflow-hidden" style={{ textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                {item.nome}
                              </td>
                              <td className="px-4 py-2.5 text-center text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                                {item.peso ? `${item.peso}kg` : item.dimensoes || '—'}
                              </td>
                              <td className="px-4 py-2.5 text-center text-gray-500 text-xs whitespace-nowrap">
                                {item.und || 'peça'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-green-700 whitespace-nowrap">
                                R$ {parseFloat(item.preco_fabricante).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto disponível</h3>
                  <p className="text-gray-600">O fabricante ainda não publicou produtos com preço.</p>
                </div>
              )}

              {/* Rodapé comercial */}
              {products.length > 0 && (
                <div className="rounded-lg border p-4" style={{ borderColor: c.lightBorder, background: '#f8fafc' }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Condições de Pagamento', value: 'À vista, cartão, boleto ou transferência' },
                      { label: 'Prazo de Produção', value: 'Consultar disponibilidade no pedido' },
                      { label: 'Frete', value: 'Calculado conforme destino e volume' },
                      { label: 'Validade', value: `Válida em ${new Date().toLocaleDateString('pt-BR')}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded border p-2.5" style={{ borderColor: c.lightBorder }}>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                        <div className="text-xs text-gray-700">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">
                    ⚠️ <strong>Aviso:</strong> Esta tabela pode sofrer alterações sem aviso prévio. Consulte disponibilidade antes de confirmar o pedido.
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-400">
                    <span>Gerado por PlaceFit — Plataforma de Fabricantes de Equipamentos Fitness</span>
                    <span>{fabricante.empresa || fabricante.full_name} · {new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}