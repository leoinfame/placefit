import { montarHtmlPedido } from "../../base44/shared/pedidoPdfHtml.js";
import { paletaDaLoja } from "../../base44/shared/identidadeCores.js";
import { base44 } from "@/api/base44Client";
/**
 * Gera um PDF profissional de orçamento ou pedido de venda
 * com identidade visual extraída da logo do usuário.
 */

function rgbFromHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function luminance({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Extrai as cores predominantes de uma imagem URL via Canvas.
 * Retorna uma promise com { primary, secondary, light, textOnPrimary }
 */
function extractColorsFromLogo(logoUrl) {
  return new Promise((resolve) => {
    const defaults = {
      primary: "#1e3a5f",
      primaryDark: "#0f172a",
      secondary: "#16a34a",
      light: "#eff6ff",
      lightBorder: "#bfdbfe",
      textOnPrimary: "#ffffff",
    };

    if (!logoUrl) return resolve(defaults);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;
        const colorMap = {};

        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2], a = imageData[i + 3];
          if (a < 128) continue;
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue;
          const qr = Math.min(255, Math.round(r / 32) * 32); // 248→256 gerava cor inválida
          const qg = Math.min(255, Math.round(g / 32) * 32); // 248→256 gerava cor inválida
          const qb = Math.min(255, Math.round(b / 32) * 32); // 248→256 gerava cor inválida
          const key = `${qr},${qg},${qb}`;
          colorMap[key] = (colorMap[key] || 0) + 1;
        }

        const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return resolve(defaults);

        const [r1, g1, b1] = sorted[0][0].split(",").map(Number);
        let secondary = null;
        for (let i = 1; i < sorted.length; i++) {
          const [r2, g2, b2] = sorted[i][0].split(",").map(Number);
          const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          if (diff > 80) { secondary = { r: r2, g: g2, b: b2 }; break; }
        }
        if (!secondary) secondary = { r: Math.max(0, Math.round(r1 * 0.7)), g: Math.max(0, Math.round(g1 * 0.7)), b: Math.max(0, Math.round(b1 * 0.7)) };

        const toHex = ({ r, g, b }) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        const primary = { r: r1, g: g1, b: b1 };
        const lum = luminance(primary);

        resolve({
          primary: toHex(primary),
          primaryDark: toHex({ r: Math.max(0, Math.round(r1 * 0.75)), g: Math.max(0, Math.round(g1 * 0.75)), b: Math.max(0, Math.round(b1 * 0.75)) }),
          secondary: toHex(secondary),
          light: toHex({ r: Math.min(255, Math.round(r1 + (255 - r1) * 0.88)), g: Math.min(255, Math.round(g1 + (255 - g1) * 0.88)), b: Math.min(255, Math.round(b1 + (255 - b1) * 0.88)) }),
          lightBorder: toHex({ r: Math.min(255, Math.round(r1 + (255 - r1) * 0.65)), g: Math.min(255, Math.round(g1 + (255 - g1) * 0.65)), b: Math.min(255, Math.round(b1 + (255 - b1) * 0.65)) }),
          textOnPrimary: lum > 140 ? "#1e293b" : "#ffffff",
        });
      } catch {
        resolve(defaults);
      }
    };
    img.onerror = () => resolve(defaults);
    img.src = logoUrl;
  });
}

/**
 * Abre uma janela com o PDF profissional e dispara impressão.
 * @param {object} pedido - dados do pedido/orçamento
 * @param {object} user   - usuário logado (revendedor/fabricante)
 * @param {array}  clientes - lista de clientes para buscar dados completos
 * @param {string} tipo - "orcamento" | "venda"
 */
export async function generateProfessionalPDF(pedido, user, clientes, tipo = "venda", products = []) {
  const cliente = clientes.find(c => c.id === pedido.cliente_id) || { nome: pedido.cliente_nome };
  // Identidade visual configurada (Perfil → Identidade visual); sem ela, cores da logo
  let paleta = null;
  try {
    const lojas = await base44.entities.LojaConfig.filter({ revendedor_id: user?.id });
    paleta = paletaDaLoja(lojas?.[0]);
  } catch { paleta = null; }
  const colors = paleta || await extractColorsFromLogo(user?.logomarca);

  // Calcular peso total
  const pesoTotal = (pedido.itens || []).reduce((sum, item) => {
    const prod = products.find(p => p.id === item.product_id);
    const peso = prod?.peso_kg ? parseFloat(prod.peso_kg) : (prod?.peso ? parseFloat(prod.peso) : 0);
    return sum + peso * (item.quantidade || 1);
  }, 0);

  const html = montarHtmlPedido({ pedido, user, cliente, tipo, pesoTotal, colors });

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => win.print(), 600);
}