import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Lock, Unlock, Upload, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

// Dicionário de tradução para termos aduaneiros
const TERMOS_ADUANEIROS = {
  "anilha bumper": "Rubber Bumper Plate for Fitness",
  "bumper plate": "Rubber Bumper Plate for Fitness",
  "kettlebell": "Cast Iron Kettlebell for Fitness",
  "halter": "Chrome Dumbbell for Fitness",
  "halteres": "Chrome Dumbbell Set for Fitness",
  "barra olímpica": "Olympic Barbell for Fitness",
  "barra olimpica": "Olympic Barbell for Fitness",
  "rack": "Power Rack / Squat Stand for Fitness",
  "esteira": "Motorized Treadmill for Fitness",
  "bicicleta ergométrica": "Stationary Bicycle for Fitness",
  "bicicleta ergometrica": "Stationary Bicycle for Fitness",
  "remo": "Rowing Machine for Fitness",
  "elíptico": "Elliptical Cross Trainer for Fitness",
  "eliptico": "Elliptical Cross Trainer for Fitness",
  "colchonete": "Exercise Mat for Fitness",
  "corda de pular": "Jump Rope for Fitness",
  "faixa elástica": "Resistance Band for Fitness",
  "faixa elastica": "Resistance Band for Fitness",
  "step": "Aerobic Step Platform for Fitness",
  "banco": "Adjustable Weight Bench for Fitness",
  "leg press": "Leg Press Machine for Fitness",
  "polia": "Cable Pulley Machine for Fitness",
  "supino": "Chest Press Bench for Fitness",
  "smith machine": "Smith Machine Gym Equipment",
  "multifuncional": "Multi-Station Home Gym Machine",
  "anilha": "Weight Plate for Fitness",
  "peso": "Weight Plate for Fitness",
  "cinto": "Weightlifting Belt for Fitness",
  "luva": "Weightlifting Gloves for Fitness",
};

function traduzirTermoAduaneiro(nome) {
  if (!nome) return "Fitness Equipment (NCM 9506.91.00)";
  const nomeLower = nome.toLowerCase();
  for (const [pt, en] of Object.entries(TERMOS_ADUANEIROS)) {
    if (nomeLower.includes(pt)) return en;
  }
  // Genérico se não achar
  return `${nome} - Fitness Equipment (NCM 9506.91.00)`;
}

function gerarQRCodeUrl(pedidoId) {
  const texto = `https://placefit.com.br/pedido/${pedidoId}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(texto)}`;
}

function gerarHtmlInvoice({ pedido, taxaCambio }) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const numero = pedido.numero_pedido || pedido.id?.slice(-8).toUpperCase();
  const qrUrl = gerarQRCodeUrl(pedido.id);
  const taxaRMB = pedido.taxa_cambio_rmb_brl || taxaCambio?.RMB || 0.77;
  const taxaUSD = pedido.taxa_cambio_usd_brl || taxaCambio?.USD || 5.8;

  const itens = pedido.itens || [];
  const totalUSD = itens.reduce((sum, item) => {
    const valorRMB = (item.preco_unitario || 0) * (item.quantidade || 1);
    const valorBRL = valorRMB * taxaRMB;
    return sum + valorBRL / taxaUSD;
  }, 0);

  const itensRows = itens.map((item, idx) => {
    const descEn = traduzirTermoAduaneiro(item.descricao || "");
    const qty = item.quantidade || 1;
    const unitUSD = ((item.preco_unitario || 0) * taxaRMB / taxaUSD);
    const totalItem = unitUSD * qty;
    return `
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;">${item.descricao || "—"}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px;color:#666;">${descEn}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">9506.91.00</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${qty}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:right;">USD ${unitUSD.toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:right;">USD ${totalItem.toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${item.peso_kg || "—"} kg</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${item.cbm || "—"} m³</td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1a202c; }
    .page { width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .logo-block h1 { font-size: 24px; font-weight: bold; color: #1e40af; margin: 0 0 4px; }
    .logo-block p { font-size: 11px; color: #64748b; margin: 0; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 20px; font-weight: bold; color: #1e40af; margin: 0 0 4px; }
    .doc-title p { font-size: 11px; color: #64748b; margin: 2px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .info-box h4 { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin: 0 0 8px; }
    .info-box p { font-size: 12px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead { background: #1e40af; color: white; }
    thead th { padding: 8px; font-size: 11px; text-align: left; }
    .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
    .totals-box { background: #f0f9ff; border: 2px solid #1e40af; border-radius: 8px; padding: 12px 20px; text-align: right; min-width: 220px; }
    .totals-box p { margin: 3px 0; font-size: 12px; }
    .totals-box .total-final { font-size: 16px; font-weight: bold; color: #1e40af; }
    .escrow-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 11px; color: #15803d; }
    .qr-section { display: flex; align-items: center; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 16px; }
    .qr-section p { font-size: 11px; color: #64748b; margin: 2px 0; }
    .section-title { font-size: 14px; font-weight: bold; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 4px; margin: 20px 0 12px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; }
    .badge-escrow { background: #dcfce7; color: #15803d; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
<div class="page">
  <!-- COMMERCIAL INVOICE -->
  <div class="header">
    <div class="logo-block">
      <h1>🏋️ PlaceFit</h1>
      <p>Plataforma de Importação Fitness</p>
      <p>CNPJ: XX.XXX.XXX/0001-XX</p>
    </div>
    <div class="doc-title">
      <h2>COMMERCIAL INVOICE</h2>
      <p>Invoice No.: <strong>INV-${numero}</strong></p>
      <p>Date: ${dataHoje}</p>
      <p>NCM: 9506.91.00</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Exporter (Seller)</h4>
      <p><strong>${pedido.fabricante_nome || "Factory Name"}</strong></p>
      <p>China</p>
    </div>
    <div class="info-box">
      <h4>Importer (Buyer)</h4>
      <p><strong>PlaceFit Importações Ltda.</strong></p>
      <p>Brasil</p>
    </div>
    <div class="info-box">
      <h4>Order Reference</h4>
      <p>PlaceFit Order: <strong>#${numero}</strong></p>
      <p>Port of Loading: Qingdao, China</p>
      <p>Port of Discharge: Santos/Itajaí, Brazil</p>
    </div>
    <div class="info-box">
      <h4>Payment & Incoterm</h4>
      <p>Incoterm: <strong>FOB Qingdao</strong></p>
      <p>Payment: <strong>T/T (Escrow PlaceFit)</strong></p>
      <p>Exchange: USD → BRL @ R$ ${taxaUSD.toFixed(4)} | RMB @ R$ ${taxaRMB.toFixed(4)}</p>
    </div>
  </div>

  <div class="section-title">Items Description</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description (PT)</th>
        <th>Customs Description (EN)</th>
        <th>HS Code</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
        <th>Weight</th>
        <th>CBM</th>
      </tr>
    </thead>
    <tbody>
      ${itensRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <p>Subtotal: <strong>USD ${totalUSD.toFixed(2)}</strong></p>
      <p>Freight (LCL): <strong>COLLECT</strong></p>
      <p>Insurance: <strong>INCLUDED</strong></p>
      <p class="total-final">TOTAL: USD ${totalUSD.toFixed(2)}</p>
      <p style="font-size:10px;color:#64748b;">≈ R$ ${(totalUSD * taxaUSD).toFixed(2)} BRL</p>
    </div>
  </div>

  <div class="escrow-box">
    🔒 <strong>ESCROW PLACEFIT GARANTIDO:</strong> O valor de R$ ${(totalUSD * taxaUSD).toFixed(2)} está congelado na plataforma PlaceFit e será liberado ao fabricante somente após comprovação de entrega no HUB de consolidação ou registro do código de rastreio internacional.
  </div>

  <div class="qr-section">
    <img src="${qrUrl}" alt="QR Code Pedido" width="90" height="90" />
    <div>
      <p><strong>QR Code de Conferência — PlaceFit Order #${numero}</strong></p>
      <p>Escaneie para verificar o pedido no sistema</p>
      <p>https://placefit.com.br/pedido/${pedido.id}</p>
      <p style="margin-top:4px;"><span class="badge badge-escrow">🔒 ESCROW ATIVO</span></p>
    </div>
  </div>

  <!-- PACKING LIST -->
  <div class="page-break"></div>

  <div class="header">
    <div class="logo-block">
      <h1>🏋️ PlaceFit</h1>
      <p>Plataforma de Importação Fitness</p>
    </div>
    <div class="doc-title">
      <h2>PACKING LIST</h2>
      <p>Ref.: <strong>PKG-${numero}</strong></p>
      <p>Date: ${dataHoje}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Shipper</h4>
      <p><strong>${pedido.fabricante_nome || "Factory Name"}</strong></p>
      <p>China</p>
    </div>
    <div class="info-box">
      <h4>Consignee</h4>
      <p><strong>PlaceFit Importações Ltda.</strong></p>
      <p>Brasil</p>
    </div>
  </div>

  <div class="section-title">Packing Details</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description (EN)</th>
        <th>HS Code</th>
        <th>Qty</th>
        <th>Unit Weight (kg)</th>
        <th>Total Weight (kg)</th>
        <th>Unit CBM (m³)</th>
        <th>Total CBM (m³)</th>
      </tr>
    </thead>
    <tbody>
      ${itens.map((item, idx) => {
        const descEn = traduzirTermoAduaneiro(item.descricao || "");
        const qty = item.quantidade || 1;
        const totalW = (item.peso_kg || 0) * qty;
        const totalCBM = (item.cbm || 0) * qty;
        return `
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;">${idx + 1}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;">${descEn}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">9506.91.00</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${qty}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${item.peso_kg || "—"}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${totalW.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${item.cbm || "—"}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${totalCBM.toFixed(4)}</td>
          </tr>
        `;
      }).join("")}
      <tr style="background:#f0f9ff;font-weight:bold;">
        <td colspan="5" style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:right;">TOTAL</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${(pedido.peso_total_kg || 0).toFixed(2)} kg</td>
        <td style="padding:8px;border:1px solid #e2e8f0;"></td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;text-align:center;">${(pedido.cbm_total || 0).toFixed(4)} m³</td>
      </tr>
    </tbody>
  </table>

  <div class="qr-section">
    <img src="${qrUrl}" alt="QR Code Pedido" width="90" height="90" />
    <div>
      <p><strong>Warehouse QR Verification — PlaceFit #${numero}</strong></p>
      <p>Scan to verify at HUB consolidation warehouse</p>
      <p>Total CBM: <strong>${(pedido.cbm_total || 0).toFixed(4)} m³</strong> | Total Weight: <strong>${(pedido.peso_total_kg || 0).toFixed(2)} kg</strong></p>
    </div>
  </div>

  <div class="footer">
    Generated by PlaceFit Export Docs Generator · ${new Date().toISOString()} · All values in USD at rate R$ ${taxaUSD.toFixed(4)}/USD
  </div>
</div>
</body>
</html>
  `;
}

export default function ExportDocsGenerator({ pedido, taxaCambio, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [comprovanteUrl, setComprovanteUrl] = useState(pedido.comprovante_entrega_hub || "");
  const [liberandoEscrow, setLiberandoEscrow] = useState(false);
  const [uploadingComp, setUploadingComp] = useState(false);

  const handleGerarDocs = () => {
    setGenerating(true);
    setTimeout(() => {
      const html = gerarHtmlInvoice({ pedido, taxaCambio });
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 800);
      }
      setGenerating(false);
    }, 100);
  };

  const handleUploadComprovante = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingComp(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setComprovanteUrl(file_url);
    setUploadingComp(false);
  };

  const handleLiberarEscrow = async () => {
    if (!comprovanteUrl) return;
    setLiberandoEscrow(true);
    await base44.entities.PedidoChina.update(pedido.id, {
      escrow_status: "liberado",
      comprovante_entrega_hub: comprovanteUrl,
      status: pedido.status === "aguardando_fabrica" ? "em_producao" : pedido.status,
    });
    setLiberandoEscrow(false);
    setShowModal(false);
    if (onUpdate) onUpdate();
  };

  const escrowStatus = pedido.escrow_status || "pendente";
  const escrowColors = {
    pendente: "bg-gray-100 text-gray-600",
    congelado: "bg-blue-100 text-blue-800",
    liberado: "bg-green-100 text-green-800",
    estornado: "bg-red-100 text-red-800",
  };
  const escrowIcons = {
    pendente: <AlertCircle className="w-3.5 h-3.5" />,
    congelado: <Lock className="w-3.5 h-3.5" />,
    liberado: <CheckCircle className="w-3.5 h-3.5" />,
    estornado: <AlertCircle className="w-3.5 h-3.5" />,
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={handleGerarDocs}
          disabled={generating}
          className="text-blue-700 border-blue-200 hover:bg-blue-50"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
          Invoice + Packing List
        </Button>

        <Badge className={`${escrowColors[escrowStatus]} flex items-center gap-1 cursor-pointer`}
          onClick={() => setShowModal(true)}>
          {escrowIcons[escrowStatus]}
          Escrow: {escrowStatus.charAt(0).toUpperCase() + escrowStatus.slice(1)}
        </Badge>

        {escrowStatus === "congelado" && (
          <Button size="sm" onClick={() => setShowModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white text-xs">
            <Unlock className="w-3.5 h-3.5 mr-1" /> Liberar Pagamento
          </Button>
        )}
      </div>

      {/* Modal Escrow */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Gestão de Escrow — #{pedido.numero_pedido || pedido.id?.slice(-8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status atual */}
            <Card className={`border-0 ${escrowStatus === "liberado" ? "bg-green-50" : escrowStatus === "congelado" ? "bg-blue-50" : "bg-gray-50"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${escrowStatus === "liberado" ? "bg-green-100" : escrowStatus === "congelado" ? "bg-blue-100" : "bg-gray-100"}`}>
                    {escrowStatus === "liberado" ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                     escrowStatus === "congelado" ? <Lock className="w-5 h-5 text-blue-600" /> :
                     <AlertCircle className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Status: {escrowStatus.toUpperCase()}</p>
                    {pedido.escrow_valor_brl && (
                      <p className="text-xs text-gray-600">Valor: R$ {pedido.escrow_valor_brl?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Como funciona o Escrow PlaceFit:
              </p>
              <p>🔒 Ao confirmar o pedido, o valor fica <strong>congelado</strong> na plataforma.</p>
              <p>🏭 A fábrica produz com a garantia de pagamento assegurado.</p>
              <p>📦 Quando a fábrica entrega no HUB e sobe o comprovante, o pagamento é <strong>liberado</strong> automaticamente.</p>
              <p>🛡️ Você só paga se a fábrica enviar. A fábrica sabe que o dinheiro está garantido.</p>
            </div>

            {escrowStatus !== "liberado" && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Comprovante de Entrega no HUB / Código de Rastreio
                </Label>
                <Input
                  placeholder="Cole URL do comprovante ou código de rastreio"
                  value={comprovanteUrl}
                  onChange={e => setComprovanteUrl(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">ou</span>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadComprovante} />
                    <Button type="button" variant="outline" size="sm" disabled={uploadingComp} asChild>
                      <span>
                        {uploadingComp ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                        Upload Comprovante
                      </span>
                    </Button>
                  </label>
                </div>
                {comprovanteUrl && (
                  <p className="text-xs text-green-700 bg-green-50 rounded p-2">✅ Comprovante pronto. Clique em "Liberar" para descongelar o pagamento.</p>
                )}
              </div>
            )}

            {escrowStatus === "liberado" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                ✅ Pagamento liberado para o fabricante com sucesso!
                {pedido.comprovante_entrega_hub && (
                  <p className="mt-1 text-xs"><a href={pedido.comprovante_entrega_hub} target="_blank" rel="noopener noreferrer" className="underline">Ver comprovante</a></p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Fechar</Button>
            {escrowStatus !== "liberado" && (
              <Button
                onClick={handleLiberarEscrow}
                disabled={!comprovanteUrl || liberandoEscrow}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {liberandoEscrow ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                Liberar Pagamento ao Fabricante
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}