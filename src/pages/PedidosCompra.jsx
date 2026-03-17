import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getFabricanteNames } from "@/functions/getFabricanteNames";
import {
  ShoppingCart, Package, Search, Eye, FileText, MessageCircle,
  ChevronRight, ArrowLeft, Building2, User, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const fmtBRL = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

const STATUS_COLORS_VENDA = {
  pendente: "bg-amber-100 text-amber-700",
  confirmado: "bg-blue-100 text-blue-700",
  em_separacao: "bg-purple-100 text-purple-700",
  enviado: "bg-indigo-100 text-indigo-700",
  entregue: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

const STATUS_COLORS_PC = {
  pendente: "bg-yellow-100 text-yellow-800",
  enviado: "bg-indigo-100 text-indigo-800",
  confirmado: "bg-blue-100 text-blue-800",
  em_producao: "bg-purple-100 text-purple-800",
  despachado: "bg-cyan-100 text-cyan-800",
  recebido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const STATUS_LABELS_PC = {
  pendente: "Pendente", enviado: "Enviado", confirmado: "Confirmado",
  em_producao: "Em Produção", despachado: "Despachado", recebido: "Recebido", cancelado: "Cancelado",
};

// Gera HTML do PDF do Pedido de Compra
function buildOrderHTML(pedidoCompra, revendedor) {
  const fab = {
    nome: pedidoCompra.fabricante_nome || "—",
    logomarca: pedidoCompra.fabricante_logomarca || null,
    whatsapp: pedidoCompra.fabricante_whatsapp || null,
    email: pedidoCompra.fabricante_email || null,
    cnpj: pedidoCompra.fabricante_cnpj || null,
  };
  const itensRows = (pedidoCompra.itens || []).map(item => `
    <tr>
      <td>${item.cod || "-"}</td>
      <td>${item.nome}</td>
      <td style="text-align:center">${item.quantidade}</td>
      <td style="text-align:right">${fmtBRL(item.preco_unitario)}</td>
      <td style="text-align:right"><strong>${fmtBRL(item.subtotal)}</strong></td>
    </tr>`).join("");
  const total = pedidoCompra.total || 0;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pedido de Compra</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:24px}.header{display:flex;gap:16px;border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:16px}.header-side{flex:1;display:flex;flex-direction:column;gap:2px}.header-side h3{font-size:13px;font-weight:bold;margin-bottom:4px;color:#1e293b}.logo{width:48px;height:48px;object-fit:contain;border-radius:4px;margin-bottom:4px}.name{font-size:13px;font-weight:bold}.info{font-size:11px;color:#555;line-height:1.5}.divider{width:1px;background:#ddd}.ref-box{background:#f1f5f9;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:12px}.ref-box span{font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#1e40af;color:#fff;padding:8px;text-align:left;font-size:11px}td{border-bottom:1px solid #eee;padding:7px 8px;font-size:11px}tr:nth-child(even) td{background:#f9fafb}.total-row{background:#1e40af!important;color:#fff}.total-row td{color:#fff;font-weight:bold;font-size:13px;padding:10px 8px}.footer{text-align:center;color:#aaa;font-size:10px;margin-top:16px}</style>
</head><body>
<div class="header">
  <div class="header-side">
    <h3>FABRICANTE (Fornecedor)</h3>
    ${fab.logomarca ? `<img src="${fab.logomarca}" class="logo" alt="logo">` : ""}
    <div class="name">${fab.nome}</div>
    <div class="info">${fab.whatsapp ? `📱 ${fab.whatsapp}<br>` : ""}${fab.email ? `✉ ${fab.email}<br>` : ""}${fab.cnpj ? `CNPJ: ${fab.cnpj}` : ""}</div>
  </div>
  <div class="divider"></div>
  <div class="header-side">
    <h3>REVENDEDOR (Comprador)</h3>
    ${revendedor?.logomarca ? `<img src="${revendedor.logomarca}" class="logo" alt="logo">` : ""}
    <div class="name">${revendedor?.empresa || revendedor?.full_name || "—"}</div>
    <div class="info">${revendedor?.whatsapp ? `📱 ${revendedor.whatsapp}<br>` : ""}${revendedor?.email ? `✉ ${revendedor.email}<br>` : ""}${revendedor?.cnpj ? `CNPJ: ${revendedor.cnpj}` : ""}</div>
  </div>
</div>
<div class="ref-box">📦 PC: <span>${pedidoCompra.numero_pedido}</span> | Data: <span>${fmtDate(pedidoCompra.data_pedido)}</span> | Status: <span>${STATUS_LABELS_PC[pedidoCompra.status] || pedidoCompra.status}</span></div>
<table><thead><tr><th>Código</th><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
<tbody>${itensRows}<tr class="total-row"><td colspan="4" style="text-align:right">TOTAL DO PEDIDO:</td><td style="text-align:right">${fmtBRL(total)}</td></tr></tbody></table>
<div class="footer">Gerado pelo sistema PlaceFit — ${new Date().toLocaleDateString("pt-BR")}</div>
</body></html>`;
}

export default function PedidosCompra() {
  const [user, setUser] = useState(null);
  const [vendas, setVendas] = useState([]);          // Pedidos (vendas)
  const [pedidosCompra, setPedidosCompra] = useState([]); // PedidoCompra
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVenda, setSelectedVenda] = useState(null); // Venda selecionada para ver PCs
  const [previewPC, setPreviewPC] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      let vendasData = [];
      let pcsData = [];

      if (me.role === 'user' && !me.tipo_usuario) {
        // REVENDEDOR: vendas dele + todos os PCs dele
        const [todasVendas, todosPCs] = await Promise.all([
          base44.entities.Pedido.filter({ fornecedor_id: me.id }),
          base44.entities.PedidoCompra.filter({ revendedor_id: me.id }, "-created_date"),
        ]);
        vendasData = todasVendas.filter(p => p.tipo === 'venda');
        pcsData = todosPCs;
      } else if (me.role === 'user' && me.tipo_usuario === 'fabricante') {
        // FABRICANTE: PCs onde ele é receptor
        pcsData = await base44.entities.PedidoCompra.filter({ fabricante_id: me.id }, "-created_date");
        vendasData = [];
      } else if (me.role === 'admin') {
        const [todasVendas, todosPCs] = await Promise.all([
          base44.entities.Pedido.list(),
          base44.entities.PedidoCompra.list(),
        ]);
        vendasData = todasVendas.filter(p => p.tipo === 'venda');
        pcsData = todosPCs;
      }

      console.log(`✅ [PedidosCompra] ${vendasData.length} vendas, ${pcsData.length} PCs carregados`);

      setVendas(vendasData.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setPedidosCompra(pcsData);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
    setLoading(false);
  };

  // PCs vinculados a uma venda específica
  const getPCsDaVenda = (venda) => {
    return pedidosCompra.filter(pc => pc.venda_id === venda.id);
  };

  const handlePDF = (pc) => {
    try {
      const html = buildOrderHTML(pc, user);
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 600);
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao gerar PDF.", variant: "destructive" });
    }
  };

  const handleWhatsApp = (pc) => {
    const phone = pc.fabricante_whatsapp?.replace(/\D/g, "");
    const itensText = (pc.itens || [])
      .map(i => `• ${i.nome} (${i.cod || "-"}) — ${i.quantidade}x ${fmtBRL(i.preco_unitario)} = ${fmtBRL(i.subtotal)}`)
      .join("\n");
    const msg = encodeURIComponent(
      `*PEDIDO DE COMPRA — PlaceFit*\nPC: *${pc.numero_pedido}*\nData: ${fmtDate(pc.data_pedido)}\n\n*Itens:*\n${itensText}\n\n*Total: ${fmtBRL(pc.total)}*\n\nRevendedor: ${user?.empresa || user?.full_name}\nContato: ${user?.whatsapp || user?.email || "—"}`
    );
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${msg}`, "_blank");
      toast({ title: "WhatsApp", description: "Fabricante sem número cadastrado." });
    }
  };

  // Para fabricantes: visão direta dos PCs
  const isFabricante = user?.role === 'user' && user?.tipo_usuario === 'fabricante';

  const filteredVendas = vendas.filter(v =>
    !searchTerm ||
    v.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPCs = pedidosCompra.filter(pc =>
    !searchTerm ||
    pc.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.fabricante_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.revendedor_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse space-y-4 w-full max-w-2xl">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ── DETALHE: Venda selecionada → listar seus PCs ──
  if (selectedVenda) {
    const pcs = getPCsDaVenda(selectedVenda);
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedVenda(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Pedidos de Compra — <span className="text-blue-600">{selectedVenda.numero_pedido}</span>
              </h1>
              <p className="text-sm text-gray-500">
                Cliente: <strong>{selectedVenda.cliente_nome}</strong> · Data: {fmtDate(selectedVenda.data_pedido)} · Total: <strong className="text-green-700">{fmtBRL(selectedVenda.total)}</strong>
              </p>
            </div>
          </div>

          {/* Resumo da venda */}
          <Card className="border border-blue-100 bg-blue-50/40">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-gray-500">Nº Venda:</span> <span className="font-semibold">{selectedVenda.numero_pedido}</span></div>
                <div><span className="text-gray-500">Cliente:</span> <span className="font-semibold">{selectedVenda.cliente_nome}</span></div>
                <div><span className="text-gray-500">Itens:</span> <span className="font-semibold">{(selectedVenda.itens || []).length} produto(s)</span></div>
                <div><span className="text-gray-500">Status:</span> <Badge className={STATUS_COLORS_VENDA[selectedVenda.status] || "bg-gray-100 text-gray-700"}>{selectedVenda.status?.replace('_', ' ')}</Badge></div>
                <div><span className="text-gray-500">PCs gerados:</span> <span className="font-semibold text-blue-700">{pcs.length}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de PCs */}
          {pcs.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum Pedido de Compra gerado para esta venda.</p>
              <p className="text-gray-400 text-sm mt-1">Use o botão ⚡ na tela de Vendas para gerar os PCs.</p>
            </CardContent></Card>
          ) : (
            pcs.map((pc) => (
              <Card key={pc.id} className="shadow-sm border border-gray-200 overflow-hidden">
                {/* Cabeçalho do PC */}
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-gray-200 px-4 py-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Fabricante */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded border bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Fabricante (Receptor)</p>
                        <p className="font-bold text-gray-900 text-sm">{pc.fabricante_nome || "—"}</p>
                        <p className="text-xs text-gray-500">{pc.fabricante_whatsapp || pc.fabricante_email || ""}</p>
                      </div>
                    </div>
                    <div className="hidden md:block w-px h-10 bg-gray-300" />
                    {/* Revendedor */}
                    <div className="flex items-center gap-3 flex-1">
                      {user?.logomarca ? (
                        <img src={user.logomarca} alt="logo" className="w-10 h-10 object-contain rounded border bg-white p-0.5 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded border bg-green-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Revendedor (Emissor)</p>
                        <p className="font-bold text-gray-900 text-sm">{pc.revendedor_nome || user?.empresa || user?.full_name}</p>
                        <p className="text-xs text-gray-500">{user?.whatsapp || user?.email || ""}</p>
                      </div>
                    </div>
                    <div className="hidden md:block w-px h-10 bg-gray-300" />
                    {/* Referência */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">PC</p>
                        <p className="font-mono font-bold text-sm text-gray-800">{pc.numero_pedido}</p>
                        <Badge className={STATUS_COLORS_PC[pc.status] || "bg-gray-100 text-gray-700"}>
                          {STATUS_LABELS_PC[pc.status] || pc.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela de itens */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-2 text-slate-700">Código</th>
                        <th className="text-left px-4 py-2 text-slate-700">Produto</th>
                        <th className="text-center px-4 py-2 text-slate-700">Qtd</th>
                        <th className="text-right px-4 py-2 text-slate-700">Preço Unit.</th>
                        <th className="text-right px-4 py-2 text-slate-700">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pc.itens || []).map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.cod || "—"}</td>
                          <td className="px-4 py-2 font-medium">{item.nome}</td>
                          <td className="px-4 py-2 text-center">{item.quantidade}</td>
                          <td className="px-4 py-2 text-right">{fmtBRL(item.preco_unitario)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{fmtBRL(item.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="bg-green-700 text-white">
                        <td colSpan={4} className="px-4 py-3 text-right font-bold">TOTAL DO PEDIDO:</td>
                        <td className="px-4 py-3 text-right font-bold text-lg">{fmtBRL(pc.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50 border-t">
                  <Button size="sm" variant="outline" onClick={() => setPreviewPC(pc)} className="gap-1">
                    <Eye className="w-4 h-4" /> Visualizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handlePDF(pc)} className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50">
                    <FileText className="w-4 h-4" /> Exportar PDF
                  </Button>
                  <Button size="sm" onClick={() => handleWhatsApp(pc)} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Modal preview PDF */}
        {previewPC && (
          <Dialog open={!!previewPC} onOpenChange={() => setPreviewPC(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Pedido — {previewPC.fabricante_nome || "Fabricante"}</DialogTitle>
              </DialogHeader>
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: buildOrderHTML(previewPC, user) }} />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handlePDF(previewPC)}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleWhatsApp(previewPC)}>
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // ── FABRICANTE: visão direta dos PCs recebidos ──
  if (isFabricante) {
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pedidos de Compra Recebidos</h1>
            <p className="text-gray-500 text-sm mt-1">Pedidos enviados pelos revendedores para você.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white" />
          </div>

          {filteredPCs.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <ShoppingCart className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700">Nenhum pedido de compra recebido</h3>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredPCs.map((pc) => (
                <Card key={pc.id} className="hover:shadow-md transition-shadow border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono font-bold text-gray-900">{pc.numero_pedido}</span>
                          <Badge className={STATUS_COLORS_PC[pc.status] || "bg-gray-100 text-gray-700"}>
                            {STATUS_LABELS_PC[pc.status] || pc.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600"><strong>Revendedor:</strong> {pc.revendedor_nome} · <strong>Data:</strong> {fmtDate(pc.data_pedido)}</p>
                        <p className="text-xs text-gray-400 mt-1">{(pc.itens || []).length} produto(s)</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-xl font-bold text-green-700">{fmtBRL(pc.total)}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setPreviewPC(pc)} title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handlePDF(pc)} title="PDF">
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {previewPC && (
          <Dialog open={!!previewPC} onOpenChange={() => setPreviewPC(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Pedido — {previewPC.numero_pedido}</DialogTitle></DialogHeader>
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: buildOrderHTML(previewPC, user) }} />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handlePDF(previewPC)}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // ── REVENDEDOR / ADMIN: lista de Vendas → clicar para ver PCs ──
  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos de Compra</h1>
          <p className="text-gray-500 text-sm mt-1">Clique em um pedido de venda para ver os Pedidos de Compra gerados.</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="w-7 h-7 text-blue-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-blue-900">{vendas.length}</div>
              <p className="text-xs text-blue-700">Pedidos de Venda</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <Package className="w-7 h-7 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-900">{pedidosCompra.length}</div>
              <p className="text-xs text-green-700">PCs Gerados</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4 text-center">
              <Package className="w-7 h-7 text-yellow-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-yellow-900">{pedidosCompra.filter(pc => pc.status === "pendente").length}</div>
              <p className="text-xs text-yellow-700">PCs Pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar por número ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white" />
        </div>

        {/* Lista de Vendas */}
        {filteredVendas.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <ShoppingCart className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">Nenhuma venda encontrada</h3>
            <p className="text-sm text-gray-400 mt-1">Crie uma venda em "Vendas" e gere os pedidos de compra.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredVendas.map((venda) => {
              const pcsCount = pedidosCompra.filter(pc => pc.venda_id === venda.id).length;
              return (
                <Card
                  key={venda.id}
                  className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                  onClick={() => setSelectedVenda(venda)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono font-bold text-gray-900">{venda.numero_pedido}</span>
                          <Badge className={STATUS_COLORS_VENDA[venda.status] || "bg-gray-100 text-gray-700"}>
                            {venda.status?.replace('_', ' ')}
                          </Badge>
                          {pcsCount > 0 ? (
                            <Badge className="bg-blue-100 text-blue-700">{pcsCount} PC(s)</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500">Sem PCs</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600"><strong>Cliente:</strong> {venda.cliente_nome} · <strong>Data:</strong> {fmtDate(venda.data_pedido)}</p>
                        <p className="text-xs text-gray-400 mt-1">{(venda.itens || []).length} produto(s) na venda</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-xl font-bold text-green-700">{fmtBRL(venda.total)}</p>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}