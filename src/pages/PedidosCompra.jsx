import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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

const STATUS_COLORS = {
  pendente: "bg-yellow-100 text-yellow-800",
  confirmado: "bg-blue-100 text-blue-800",
  em_separacao: "bg-purple-100 text-purple-800",
  enviado: "bg-indigo-100 text-indigo-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABELS = {
  pendente: "Pendente", confirmado: "Confirmado", em_separacao: "Em Separação",
  enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
};

function buildOrderHTML(pedidoVenda, fabricante, itensFab, revendedor) {
  const itensRows = itensFab.map(item => `
    <tr>
      <td>${item.cod || "-"}</td>
      <td>${item.nome}</td>
      <td style="text-align:center">${item.quantidade}</td>
      <td style="text-align:right">${fmtBRL(item.preco_unitario)}</td>
      <td style="text-align:right"><strong>${fmtBRL(item.subtotal)}</strong></td>
    </tr>`).join("");
  const total = itensFab.reduce((s, i) => s + (i.subtotal || 0), 0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pedido de Compra</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:24px}.header{display:flex;gap:16px;border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:16px}.header-side{flex:1;display:flex;flex-direction:column;gap:2px}.header-side h3{font-size:13px;font-weight:bold;margin-bottom:4px;color:#1e293b !important}.logo{width:48px;height:48px;object-fit:contain;border-radius:4px;margin-bottom:4px}.name{font-size:13px;font-weight:bold}.info{font-size:11px;color:#555;line-height:1.5}.divider{width:1px;background:#ddd}.ref-box{background:#f1f5f9;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:12px}.ref-box span{font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#1e40af;color:#fff;padding:8px;text-align:left;font-size:11px}td{border-bottom:1px solid #eee;padding:7px 8px;font-size:11px}tr:nth-child(even) td{background:#f9fafb}.total-row{background:#1e40af!important;color:#fff}.total-row td{color:#fff;font-weight:bold;font-size:13px;padding:10px 8px}.footer{text-align:center;color:#aaa;font-size:10px;margin-top:16px}</style>
</head><body>
<div class="header">
  <div class="header-side"><h3>FABRICANTE (Fornecedor)</h3>${fabricante?.logomarca ? `<img src="${fabricante.logomarca}" class="logo" alt="logo">` : ""}<div class="name">${fabricante?.empresa || fabricante?.full_name || fabricante?.nome || "—"}</div><div class="info">${fabricante?.whatsapp ? `📱 ${fabricante.whatsapp}<br>` : ""}${fabricante?.email ? `✉ ${fabricante.email}<br>` : ""}${fabricante?.cnpj ? `CNPJ: ${fabricante.cnpj}` : ""}</div></div>
  <div class="divider"></div>
  <div class="header-side"><h3>REVENDEDOR (Comprador)</h3>${revendedor?.logomarca ? `<img src="${revendedor.logomarca}" class="logo" alt="logo">` : ""}<div class="name">${revendedor?.empresa || revendedor?.full_name || "—"}</div><div class="info">${revendedor?.whatsapp ? `📱 ${revendedor.whatsapp}<br>` : ""}${revendedor?.email ? `✉ ${revendedor.email}<br>` : ""}${revendedor?.cnpj ? `CNPJ: ${revendedor.cnpj}` : ""}</div></div>
</div>
<div class="ref-box">📦 Pedido referente à Venda: <span>${pedidoVenda.numero_pedido}</span> | Cliente final: <span>${pedidoVenda.cliente_nome || "—"}</span> | Data: <span>${fmtDate(pedidoVenda.data_pedido)}</span></div>
<table><thead><tr><th>Código</th><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
<tbody>${itensRows}<tr class="total-row"><td colspan="4" style="text-align:right">TOTAL DO PEDIDO:</td><td style="text-align:right">${fmtBRL(total)}</td></tr></tbody></table>
<div class="footer">Gerado pelo sistema PlaceFit — ${new Date().toLocaleDateString("pt-BR")}</div>
</body></html>`;
}

export default function PedidosCompra() {
  const [user, setUser] = useState(null);
  const [vendas, setVendas] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVenda, setSelectedVenda] = useState(null);
  const [previewPedido, setPreviewPedido] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const [products, allUsers] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.User.list(),
      ]);
      
      // Lógica diferenciada por role
      let allVendas = [];
      
      if (me.role === 'user' && !me.tipo_usuario) {
        // REVENDEDOR: busca PedidoCompra direto
        allVendas = await base44.entities.PedidoCompra.filter({ revendedor_id: me.id }, "-created_date");
      } else if (me.role === 'user' && me.tipo_usuario === 'fabricante') {
        // FABRICANTE: busca PedidoCompra onde é o receptor
        allVendas = await base44.entities.PedidoCompra.filter({ fabricante_id: me.id }, "-created_date");
      } else if (me.role === 'admin') {
        // ADMIN: busca todos
        allVendas = await base44.entities.PedidoCompra.list();
      }
      
      setVendas(allVendas);
      setAllProducts(products);
      setFabricantes(allUsers.filter(u => u.tipo_usuario === "fabricante"));
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    }
    setLoading(false);
  };

  const getPedidosPorFabricante = (pedidoCompra) => {
    // PedidoCompra já vem pronto, retorna direto em um grupo
    const fabId = pedidoCompra.fabricante_id || "__sem_fabricante__";
    const fabricante = fabricantes.find(f => f.id === fabId) || { 
      nome: pedidoCompra.fabricante_nome || "Fabricante não identificado" 
    };
    
    return [{
      fabricante_id: fabId,
      fabricante,
      itens: pedidoCompra.itens || [],
      total: pedidoCompra.total || 0
    }];
  };

  const handlePDF = (venda, grupo) => {
    try {
      const html = buildOrderHTML(venda, grupo.fabricante, grupo.itens, user);
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 600);
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro", description: "Erro ao gerar PDF.", variant: "destructive" });
    }
  };

  const handleWhatsApp = (venda, grupo) => {
    const fab = grupo.fabricante;
    const phone = fab?.whatsapp?.replace(/\D/g, "");
    const itensText = grupo.itens
      .map(i => `• ${i.nome} (${i.cod || "-"}) — ${i.quantidade}x ${fmtBRL(i.preco_unitario)} = ${fmtBRL(i.subtotal)}`)
      .join("\n");
    const msg = encodeURIComponent(
      `*PEDIDO DE COMPRA — PlaceFit*\nRef. Venda: *${venda.numero_pedido}*\nCliente final: ${venda.cliente_nome || "—"}\nData: ${fmtDate(venda.data_pedido)}\n\n*Itens solicitados:*\n${itensText}\n\n*Total: ${fmtBRL(grupo.total)}*\n\nRevendedor: ${user?.empresa || user?.full_name}\nContato: ${user?.whatsapp || user?.email || "—"}`
    );
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${msg}`, "_blank");
      toast({ title: "WhatsApp", description: "Fabricante sem número cadastrado." });
    }
  };

  const filteredVendas = vendas.filter(v =>
   !searchTerm ||
   v.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
   v.fabricante_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
   v.revendedor_nome?.toLowerCase().includes(searchTerm.toLowerCase())
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

  if (selectedVenda) {
    const grupos = getPedidosPorFabricante(selectedVenda);
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedVenda(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Pedido de Compra — <span className="text-blue-600">{selectedVenda.numero_pedido}</span>
              </h1>
              <p className="text-sm text-gray-500">
                Fabricante: <strong>{selectedVenda.fabricante_nome}</strong> · Data: {fmtDate(selectedVenda.data_pedido)} · Total: <strong className="text-green-700">{fmtBRL(selectedVenda.total)}</strong>
              </p>
            </div>
          </div>

          {grupos.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum produto com fabricante identificado nesta venda.</p>
            </CardContent></Card>
          ) : (
            grupos.map((grupo, idx) => {
              const fab = grupo.fabricante;
              return (
                <Card key={idx} className="shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-gray-200 px-4 py-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        {fab?.logomarca ? (
                          <img src={fab.logomarca} alt="logo" className="w-10 h-10 object-contain rounded border bg-white p-0.5" />
                        ) : (
                          <div className="w-10 h-10 rounded border bg-blue-100 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Fabricante</p>
                          <p className="font-bold text-gray-900 text-sm">{fab?.empresa || fab?.full_name || fab?.nome}</p>
                          <p className="text-xs text-gray-500">{fab?.whatsapp || fab?.email || ""}</p>
                        </div>
                      </div>
                      <div className="hidden md:block w-px h-10 bg-gray-300" />
                      <div className="flex items-center gap-3 flex-1">
                        {user?.logomarca ? (
                          <img src={user.logomarca} alt="logo" className="w-10 h-10 object-contain rounded border bg-white p-0.5" />
                        ) : (
                          <div className="w-10 h-10 rounded border bg-green-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Revendedor</p>
                          <p className="font-bold text-gray-900 text-sm">{user?.empresa || user?.full_name}</p>
                          <p className="text-xs text-gray-500">{user?.whatsapp || user?.email || ""}</p>
                        </div>
                      </div>
                      <div className="hidden md:block w-px h-10 bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Ref. Venda</p>
                          <p className="font-mono font-bold text-sm text-gray-800">{selectedVenda.numero_pedido}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{background: 'transparent', borderBottom: '1px solid #e2e8f0'}}>
                          <th className="text-left px-4 py-2" style={{color: '#1e293b !important'}}>Código</th>
                          <th className="text-left px-4 py-2" style={{color: '#1e293b !important'}}>Produto</th>
                          <th className="text-center px-4 py-2" style={{color: '#1e293b !important'}}>Qtd</th>
                          <th className="text-right px-4 py-2" style={{color: '#1e293b !important'}}>Preço Unit.</th>
                          <th className="text-right px-4 py-2" style={{color: '#1e293b !important'}}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.itens.map((item, i) => (
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
                          <td className="px-4 py-3 text-right font-bold text-lg">{fmtBRL(grupo.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50 border-t">
                    <Button size="sm" variant="outline" onClick={() => setPreviewPedido({ venda: selectedVenda, grupo })} className="gap-1">
                      <Eye className="w-4 h-4" /> Visualizar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePDF(selectedVenda, grupo)} className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50">
                      <FileText className="w-4 h-4" /> Exportar PDF
                    </Button>
                    <Button size="sm" onClick={() => handleWhatsApp(selectedVenda, grupo)} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {previewPedido && (
          <Dialog open={!!previewPedido} onOpenChange={() => setPreviewPedido(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Pedido — {previewPedido.grupo.fabricante?.empresa || previewPedido.grupo.fabricante?.full_name || "Fabricante"}</DialogTitle>
              </DialogHeader>
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: buildOrderHTML(previewPedido.venda, previewPedido.grupo.fabricante, previewPedido.grupo.itens, user) }} />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handlePDF(previewPedido.venda, previewPedido.grupo)}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleWhatsApp(previewPedido.venda, previewPedido.grupo)}>
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos de Compra</h1>
          <p className="text-gray-500 text-sm mt-1">Selecione uma venda para visualizar os pedidos por fabricante.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="w-7 h-7 text-blue-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-blue-900">{vendas.length}</div>
              <p className="text-xs text-blue-700">Total Vendas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4 text-center">
              <Package className="w-7 h-7 text-yellow-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-yellow-900">{vendas.filter(v => v.status === "pendente").length}</div>
              <p className="text-xs text-yellow-700">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <Package className="w-7 h-7 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-900">{vendas.filter(v => v.status === "entregue").length}</div>
              <p className="text-xs text-green-700">Entregues</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4 text-center">
              <Building2 className="w-7 h-7 text-purple-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-purple-900">{fabricantes.length}</div>
              <p className="text-xs text-purple-700">Fabricantes</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar por número de pedido ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white" />
        </div>

        {filteredVendas.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <ShoppingCart className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">Nenhuma venda encontrada</h3>
            <p className="text-sm text-gray-400 mt-1">As vendas criadas na página "Vendas" aparecerão aqui.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredVendas.map((venda) => {
              const grupos = getPedidosPorFabricante(venda);
              return (
                <Card key={venda.id} className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200" onClick={() => setSelectedVenda(venda)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono font-bold text-gray-900">{venda.numero_pedido}</span>
                          <Badge className={STATUS_COLORS[venda.status] || "bg-gray-100 text-gray-700"}>
                            {STATUS_LABELS[venda.status] || venda.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600"><strong>Cliente:</strong> {venda.cliente_nome} · <strong>Data:</strong> {fmtDate(venda.data_pedido)}</p>
                        <p className="text-xs text-gray-400 mt-1">{grupos.length} pedido(s) de compra · {(venda.itens || []).length} produto(s)</p>
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