import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Store, Download, MessageSquare, Package, Search, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import AIResponseFormatter from "@/components/AIResponseFormatter";
import ComissaoConfig from "@/components/ComissaoConfig";
import { getProdutosData } from "@/functions/getProdutosData";
import { expandTemplates } from "@/utils/expandTemplates";

const normalizeName = (s) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\w\s]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const GROUP_FIELDS = [
  "categoria", "subcategoria", "tipo_anilha", "tipo_furo", "acabamento",
  "barra_formato", "barra_acabamento", "presilha_tipo", "comprimento_m",
  "barra_rolamento", "bojo_formato", "dumbell_tipo",
  "piso_espessura_mm", "piso_formato", "tijolinho_tipo", "tijolinho_torre",
  "suporte_modelo", "suporte_estrutura", "suporte_degraus",
  "suporte_capacidade_pares", "suporte_capacidade_unidades",
  "suporte_torre_capacidade", "suporte_torre_tipo",
  "pegada", "peso_faixa"
];

const WEIGHT_TOKEN_RE = /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*kg(?![\p{L}\p{N}])/giu;

const extractWeightFromName = (nome) => {
  const m = (nome || "").match(WEIGHT_TOKEN_RE);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/kg/i, "").replace(",", ".").trim());
  return isNaN(n) ? null : n;
};

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG"];
const SIZE_CANONICAL = {
  PP: "PP", P: "P", M: "M", G: "G", GG: "GG", XG: "XG",
  PEQUENO: "P", MEDIO: "M", GRANDE: "G",
};
const normSizeKey = (k) => k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const SIZE_PAREN_RE = /\((PP|XG|GG|P|M|G)\)|\((PP|XG|GG|P|M|G)(?=\s*$)/gi;
const SIZE_LETTER_RE = /(?<![\p{L}\p{N}])(PP|XG|GG|P|M|G)(?![\p{L}\p{N}])/giu;
const SIZE_WORD_RE = /(?<![\p{L}\p{N}])(Pequeno|Médio|Medio|Grande)(?![\p{L}\p{N}])/giu;

const extractSizesFromName = (nome) => {
  const s = nome || "";
  const found = new Set();
  for (const m of s.matchAll(SIZE_PAREN_RE)) {
    const key = m[1] || m[2];
    if (key) found.add(SIZE_CANONICAL[normSizeKey(key)]);
  }
  for (const m of s.matchAll(SIZE_LETTER_RE)) {
    found.add(SIZE_CANONICAL[normSizeKey(m[1])]);
  }
  for (const m of s.matchAll(SIZE_WORD_RE)) {
    found.add(SIZE_CANONICAL[normSizeKey(m[1])]);
  }
  return [...found];
};

const getBaseName = (tmpl) => {
  let nome = (tmpl.nome || "");
  nome = nome.replace(WEIGHT_TOKEN_RE, " ");
  nome = nome.replace(/\((PP|XG|GG|P|M|G)\)/gi, " ");
  nome = nome.replace(/\((PP|XG|GG|P|M|G)(?=\s*$)/gi, " ");
  nome = nome.replace(SIZE_LETTER_RE, " ");
  nome = nome.replace(SIZE_WORD_RE, " ");
  nome = nome.replace(/\s+/g, " ").trim();
  nome = nome.replace(/^[,()/\\-]+|[,()/\\-]+$/g, "").trim();
  return nome;
};

const getGroupKey = (tmpl) => getBaseName(tmpl).toLowerCase() + "|" + GROUP_FIELDS.map(f => tmpl[f] ?? "").join("|");

const DIM_RE = /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?:\s*[xX×]\s*\d+(?:[.,]\d+)?){1,2}(?:\s*(?:mm|cm|m|mts?))?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:mm|cm|mts?|metros?|m|pol)(?![\p{L}\p{N}])/giu;
const TBL_SKIP = ["piso_espessura_mm", "piso_formato", "comprimento_m", "peso_faixa"];
const tblBase = (tmpl) => getBaseName(tmpl).replace(DIM_RE, " ").replace(/\bmodular\b/gi, " ").replace(/^(colchonete\b.*?)\s*&\s*Cia\b/i, "$1").replace(/\s+/g, " ").replace(/^[,()/\\-]+|[,()/\\-]+$/g, "").trim();
const tblKey = (tmpl) => tblBase(tmpl).toLowerCase() + "|" + GROUP_FIELDS.filter(f => !TBL_SKIP.includes(f)).map(f => tmpl[f] ?? "").join("|");
const tblDims = (tmpl) => ((tmpl.nome || "").match(DIM_RE) || []).map(x => x.replace(/\s+/g, "")).join(" ");

function FamilyPhoto({ candidates, alt, className }) {
  const [idx, setIdx] = useState(0);
  const src = candidates && candidates[idx];
  if (!src) {
    return <Package className="w-8 h-8 text-gray-300" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setIdx(i => (i + 1 < candidates.length ? i + 1 : candidates.length))}
    />
  );
}

export default function FabricantesRevendedor() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [filteredFabricantes, setFilteredFabricantes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFabricante, setSelectedFabricante] = useState(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showCatalogoDialog, setShowCatalogoDialog] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [catalogoProducts, setCatalogoProducts] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [downloadingTable, setDownloadingTable] = useState(null);
  const [showPerfilDialog, setShowPerfilDialog] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredFabricantes(
        fabricantes.filter(f =>
          f.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredFabricantes(fabricantes);
    }
  }, [searchTerm, fabricantes]);

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setLoading(true);
      }
      
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Usar função backend com service role
      console.log("🔍 Buscando fabricantes via backend...");
      const response = await base44.functions.invoke('getFabricantes', {});
      
      console.log("📦 Resposta recebida:", response);
      
      // Verificar se a resposta tem a estrutura correta
      if (!response || !response.data) {
        throw new Error("Nenhuma resposta do servidor");
      }
      
      if (!response.data.fabricantes) {
        throw new Error("Formato de resposta inválido do servidor");
      }
      
      const fabricantesList = response.data.fabricantes;
      console.log("✅ Fabricantes encontrados:", fabricantesList.length);
      
      setFabricantes(fabricantesList);
      setFilteredFabricantes(fabricantesList);
      
      if (forceRefresh) {
        toast({
          title: "Atualizado!",
          description: "Lista de fabricantes recarregada.",
        });
      }
    } catch (error) {
      console.error("❌ Erro ao carregar fabricantes:", error);
      toast({
        title: "Erro ao carregar fabricantes",
        description: error.message || "Não foi possível carregar fabricantes.",
        variant: "destructive",
      });
      setFabricantes([]);
      setFilteredFabricantes([]);
    }
    setLoading(false);
  };

  const extractLogoColors = (logoUrl) => {
    return new Promise((resolve) => {
      if (!logoUrl) { resolve(null); return; }
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const colorMap = {};
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a < 128) continue;
            const brightness = (r + g + b) / 3;
            if (brightness > 240 || brightness < 20) continue;
            const key = `${Math.round(r/20)*20},${Math.round(g/20)*20},${Math.round(b/20)*20}`;
            colorMap[key] = (colorMap[key] || 0) + 1;
          }
          const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
          if (!sorted.length) { resolve(null); return; }
          const [r1, g1, b1] = sorted[0][0].split(',').map(Number);
          const toHex = (r, g, b) => `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
          const darken = (r, g, b, f=0.6) => toHex(Math.round(r*f), Math.round(g*f), Math.round(b*f));
          const lighten = (r, g, b, f=0.9) => toHex(Math.round(255-(255-r)*f), Math.round(255-(255-g)*f), Math.round(255-(255-b)*f));
          resolve({
            primary: toHex(r1, g1, b1),
            primaryDark: darken(r1, g1, b1),
            secondary: toHex(r1, g1, b1),
            light: lighten(r1, g1, b1),
            lightBorder: lighten(r1, g1, b1, 0.6),
            textOnPrimary: '#ffffff',
            textAccent: darken(r1, g1, b1, 0.7),
          });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
  };

  // Converte imagem URL -> base64 data URL para embed no HTML de impressão
  const fetchImageAsDataURL = async (url) => {
    if (!url) return null;
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const downloadFabricanteTable = async (fabricante) => {
    setDownloadingTable(fabricante.id);
    try {
      // Mesma fonte do catálogo (getProdutosData): templates com preço deste fabricante
      const res = await getProdutosData({ mode: "catalogo" });
      const data = res.data || res;
      const templatesAll = expandTemplates(data.templates || [], data.fieldMap);
      const pricesByProduct = data.pricesByProduct || {};
      const fabNomeBusca = fabricante.nome_fantasia || fabricante.razao_social || fabricante.empresa || fabricante.full_name;
      const fabNormBusca = normalizeName(fabNomeBusca);
      const fabricanteProducts = [];
      for (const tmpl of templatesAll) {
        const precos = (pricesByProduct[tmpl.id] || []).filter(p => {
          const pNorm = normalizeName(p && p.fabricante_nome);
          if (!fabNormBusca || !pNorm) return false;
          return fabNormBusca.includes(pNorm) || pNorm.includes(fabNormBusca);
        }).map(p => Number(p.preco_origem)).filter(n => n > 0);
        if (precos.length === 0) continue;
        fabricanteProducts.push({
          _key: tblKey(tmpl),
          _base: tblBase(tmpl),
          _dims: tblDims(tmpl),
          _sizes: extractSizesFromName(tmpl.nome),
          cod: tmpl.cod,
          nome: tmpl.nome,
          categoria: tmpl.categoria || 'Outros',
          peso: tmpl.peso_kg != null ? tmpl.peso_kg : extractWeightFromName(tmpl.nome),
          und: tmpl.und,
          foto: tmpl.foto && !tmpl.foto.includes("placefit.com.br/produtos") ? tmpl.foto : null,
          preco: Math.min(...precos),
        });
      }
      fabricanteProducts.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR', { numeric: true }));

      if (fabricanteProducts.length === 0) {
        toast({ title: "Sem produtos", description: "Este fabricante não possui produtos com preço no catálogo." });
        setDownloadingTable(null);
        return;
      }

      // Agrupar variações (peso/tamanho) de um mesmo produto: 1 produto + chips
      const gmap = new Map();
      for (const it of fabricanteProducts) {
        if (!gmap.has(it._key)) {
          gmap.set(it._key, { nome: it._base || it.nome, categoria: it.categoria, foto: null, und: it.und, cods: [], variants: [] });
        }
        const g = gmap.get(it._key);
        if (!g.foto && it.foto) g.foto = it.foto;
        g.cods.push(it.cod);
        const wl = it.peso != null ? String(it.peso).replace('.', ',') + 'kg' : (it._sizes && it._sizes.length ? it._sizes.join('/') : '');
        const label = it._dims ? it._dims : wl;
        g.variants.push({ label, peso: it.peso, size: it._sizes && it._sizes.length ? SIZE_ORDER.indexOf(it._sizes[0]) : 99, preco: it.preco, cod: it.cod, nome: it.nome });
      }
      const grupos = [...gmap.values()];
      for (const g of grupos) {
        g.variants.sort((a, b) => (a.peso != null && b.peso != null) ? a.peso - b.peso : a.size - b.size);
        if (g.variants.length === 1 && !g.variants[0].label) g.nome = g.variants[0].nome;
      }
      grupos.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR', { numeric: true }));

      // Embedar imagens (logo + fotos) como base64 para garantir exibição no PDF
      const imgUrls = new Set();
      if (fabricante.logomarca) imgUrls.add(fabricante.logomarca);
      for (const g of grupos) {
        if (g.foto) imgUrls.add(g.foto);
      }
      const imgMap = {};
      await Promise.all([...imgUrls].map(async (url) => {
        const dataUrl = await fetchImageAsDataURL(url);
        imgMap[url] = dataUrl || url;
      }));
      const getImg = (url) => imgMap[url] || url || '';

      // Extrair cores da logo (usar base64 se disponível para evitar CORS no canvas)
      const logoForColors = imgMap[fabricante.logomarca] || fabricante.logomarca;
      const logoColors = await extractLogoColors(logoForColors);
      const c = logoColors || {
        primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
        light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
      };

      const nomeEmpresa = fabricante.empresa || fabricante.full_name;
      const dataGeracao = new Date().toLocaleDateString('pt-BR');

      // Agrupar por categoria
      const categorias = {};
      grupos.forEach(p => {
        const cat = p.categoria || 'Outros';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(p);
      });

      const categoryIcons = {
        'Cardiovascular': '🏃', 'Musculação': '💪', 'Funcional': '🤸',
        'Acessórios': '🎯', 'Anilhas': '🏋️', 'Halteres': '🏋️',
        'Barras': '📊', 'Suportes': '🔧', 'Caneleiras': '🦵',
        'Tornozeleiras': '🦵', 'Cabos': '🔗', 'Complemento': '➕', 'Outros': '📦',
      };

      const ordemCats = ['Anilhas', 'Halteres', 'Dumbbells', 'Kettlebells', 'Tijolinhos', 'Pisos', 'Kits'];
      const catsOrdenadas = Object.keys(categorias).sort((x, y) => {
        const ix = ordemCats.indexOf(x), iy = ordemCats.indexOf(y);
        if (ix !== -1 && iy !== -1) return ix - iy;
        if (ix !== -1) return -1;
        if (iy !== -1) return 1;
        return x.localeCompare(y, 'pt-BR');
      });
      const fmtPreco = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Tabela densa B2B: 1 linha por produto, variações como chips na mesma linha
      const categoriasBlocos = catsOrdenadas.map((cat) => {
        const itens = categorias[cat];
        const icon = categoryIcons[cat] || '📦';
        // Linha separadora de categoria (colspan 5)
        let rows = `<tr><td colspan="5" style="background:${c.light};padding:3px 5px;border-bottom:1px solid ${c.lightBorder};">
          <span style="font-size:9pt;">${icon}</span>
          <span style="font-size:8pt;font-weight:700;color:${c.primaryDark};letter-spacing:0.5px;text-transform:uppercase;margin-left:3px;">${cat}</span>
          <span style="font-size:7pt;color:#64748b;font-weight:400;margin-left:4px;">${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</span>
        </td></tr>`;
        // Linhas de produto: foto miniatura | nome | variações (chips com preço) | und | a partir de
        for (const g of itens) {
          const precos = g.variants.map(v => v.preco);
          const mesmoPreco = precos.every(p => p === precos[0]);
          const temChips = g.variants.length > 1 || (g.variants[0] && g.variants[0].label);
          const fotoHtml = g.foto
            ? `<img src="${getImg(g.foto)}" alt="" style="width:24px;height:24px;object-fit:contain;background:#fff;border-radius:3px;border:1px solid #e2e8f0;">`
            : `<div style="width:24px;height:24px;border-radius:3px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:10px;">📦</div>`;
          const chips = temChips
            ? g.variants.map(v => `<span style="display:inline-block;font-size:7pt;color:#475569;background:#eff6ff;border:1px solid #dbeafe;padding:0 3px;border-radius:6px;margin:0 2px 1px 0;white-space:nowrap;line-height:1.5;">${v.label || v.cod}${mesmoPreco ? '' : ' · ' + fmtPreco(v.preco)}</span>`).join('')
            : `<span style="font-size:7pt;color:#94a3b8;">—</span>`;
          const precoTxt = mesmoPreco ? fmtPreco(precos[0]) : 'a partir de ' + fmtPreco(Math.min(...precos));
          const codTxt = g.cods.length > 1 ? g.cods[0] + '…' : g.cods[0];
          rows += `<tr>
            <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;">${fotoHtml}</td>
            <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;">
              <div style="font-size:8pt;font-weight:600;color:#1e293b;line-height:1.2;">${g.nome}</div>
              ${codTxt ? `<div style="font-size:6pt;font-family:monospace;color:#94a3b8;">${codTxt}</div>` : ''}
            </td>
            <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;line-height:1.6;">${chips}</td>
            <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;font-size:7pt;color:#64748b;">${g.und || 'peça'}</td>
            <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:right;font-size:8pt;font-weight:700;color:#16a34a;white-space:nowrap;">${precoTxt}</td>
          </tr>`;
        }
        return rows;
      }).join('');

      // Índice compacto de categorias
      const indexHtml = catsOrdenadas.map(cat =>
        `<span style="display:inline-block;font-size:7pt;color:${c.primaryDark};background:${c.light};border:1px solid ${c.lightBorder};padding:1px 5px;border-radius:8px;margin:1px 3px 1px 0;white-space:nowrap;">${categoryIcons[cat] || '📦'} ${cat} <span style="color:#94a3b8;font-size:6pt;">${categorias[cat].length}</span></span>`
      ).join('');

      const html = `<!DOCTYPE html>
      <html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Tabela de Preços — ${nomeEmpresa}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1e293b; background: #fff; }
    .page-wrapper { padding: 12px 16px; }
    .cover { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: transparent; border-radius: 8px; margin-bottom: 6px; }
    .cover-logo { width: 56px; height: 56px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; flex-shrink: 0; }
    .cover-logo-placeholder { width: 56px; height: 56px; background: rgba(255,255,255,0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .cover-title { font-size: 18px; font-weight: 800; color: #0f172a !important; line-height: 1.1; }
    .cover-subtitle { font-size: 9px; font-weight: 600; color: #0f172a !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; margin-top: 0px; }
    .cover-contact { font-size: 8px; color: #475569 !important; display: inline-block; margin-right: 12px; margin-top: 2px; }
    .cover-right { text-align: right; flex-shrink: 0; }
    .cover-doc-title { font-size: 11px; font-weight: 800; color: #0f172a !important; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; }
    .cover-date { font-size: 8px; color: #475569 !important; margin-top: 2px; }
    .stats-bar { display: flex; gap: 8px; margin-bottom: 12px; page-break-inside: avoid; }
    .stat-card { flex: 1; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; text-align: center; }
    .stat-num { font-size: 16px; font-weight: 800; color: ${c.primaryDark}; }
    .stat-label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
    .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .footer-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .footer-item { flex: 1; min-width: 80px; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; }
    .footer-item-label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
    .footer-item-value { font-size: 8px; color: #1e293b; font-weight: 500; }
    .footer-disclaimer { font-size: 8px; color: #64748b; line-height: 1.4; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
    .footer-brand { font-size: 7px; color: #94a3b8; }
    table.prod-table { width: 100%; border-collapse: collapse; }
    table.prod-table thead { display: table-header-group; }
    table.prod-table tr { page-break-inside: avoid; }
    table.prod-table th { background: #f1f5f9; }
    .index-bar { margin-bottom: 6px; page-break-inside: avoid; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page-wrapper">
  <div class="cover">
    ${fabricante.logomarca ? `<img src="${getImg(fabricante.logomarca)}" alt="Logo" class="cover-logo">` : `<div class="cover-logo-placeholder">🏭</div>`}
    <div style="flex:1;">
      <div class="cover-title">${nomeEmpresa}</div>
      <div style="margin-top:6px;">
        ${fabricante.whatsapp ? `<span class="cover-contact">📱 ${fabricante.whatsapp}</span>` : ''}
        ${fabricante.email ? `<span class="cover-contact">✉ ${fabricante.email}</span>` : ''}
        ${fabricante.endereco ? `<span class="cover-contact">📍 ${fabricante.endereco}</span>` : ''}
        ${fabricante.site ? `<span class="cover-contact">🌐 ${fabricante.site}</span>` : ''}
      </div>
    </div>
    <div class="cover-right">
      <div class="cover-doc-title">Tabela de<br>Preços Oficial</div>
      <div class="cover-date">📅 ${dataGeracao}</div>
    </div>
  </div>

  <div class="stats-bar">
    <div class="stat-card"><div class="stat-num">${grupos.length}</div><div class="stat-label">Produtos</div></div>
    <div class="stat-card"><div class="stat-num">${Object.keys(categorias).length}</div><div class="stat-label">Categorias</div></div>
    <div class="stat-card"><div class="stat-num">${dataGeracao}</div><div class="stat-label">Atualizado em</div></div>
  </div>

  <!-- Índice de Categorias -->
  <div class="index-bar">
    <div style="font-size:7pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Índice</div>
    <div>${indexHtml}</div>
  </div>

  <!-- Tabela de Produtos -->
  <table class="prod-table">
    <thead>
      <tr>
        <th style="padding:3px 4px;text-align:center;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:28px;"></th>
        <th style="padding:3px 4px;text-align:left;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:32%;">Produto</th>
        <th style="padding:3px 4px;text-align:left;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Variações e Preços</th>
        <th style="padding:3px 4px;text-align:center;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:24px;">Und</th>
        <th style="padding:3px 4px;text-align:right;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:60px;">A partir de</th>
      </tr>
    </thead>
    <tbody>${categoriasBlocos}</tbody>
  </table>

  <div class="footer">
    <div class="footer-grid">
      <div class="footer-item"><div class="footer-item-label">Condições de Pagamento</div><div class="footer-item-value">À vista, cartão, boleto ou transferência bancária</div></div>
      <div class="footer-item"><div class="footer-item-label">Prazo de Produção</div><div class="footer-item-value">Consultar disponibilidade no momento do pedido</div></div>
      <div class="footer-item"><div class="footer-item-label">Frete</div><div class="footer-item-value">Calculado conforme destino e volume do pedido</div></div>
      <div class="footer-item"><div class="footer-item-label">Validade da Tabela</div><div class="footer-item-value">Válida na data de geração: ${dataGeracao}</div></div>
    </div>
    <div class="footer-disclaimer">⚠️ <strong>Aviso:</strong> Esta tabela pode sofrer alterações sem aviso prévio. Consulte disponibilidade antes de confirmar o pedido.</div>
    <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid #e2e8f0;">
      <div class="footer-brand">Total: ${grupos.length} produtos · ${Object.keys(categorias).length} categorias</div>
      <div class="footer-brand">${nomeEmpresa} · ${dataGeracao}</div>
    </div>
  </div>
</div>
</body>
</html>`;

      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          // Aguardar todas as imagens carregarem antes de imprimir
          const imgs = printWindow.document.querySelectorAll('img');
          await Promise.all(Array.from(imgs).map(img =>
            img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
          ));
          setTimeout(() => printWindow.print(), 300);
        }

        toast({
          title: "Tabela gerada!",
          description: `Tabela de ${nomeEmpresa} aberta para impressão/PDF.`,
        });
      } catch (printError) {
        console.error("Erro ao imprimir:", printError);
        toast({ title: "Erro", description: "Erro ao gerar tabela para impressão.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Erro ao baixar tabela:", error);
      toast({ title: "Erro", description: "Não foi possível gerar a tabela.", variant: "destructive" });
    } finally {
      setDownloadingTable(null);
    }
  };

  const openChat = (fabricante) => {
    setSelectedFabricante(fabricante);
    setChatMessages([
      {
        role: "assistant",
        content: `Olá! Sou o assistente virtual de ${fabricante.empresa || fabricante.full_name}. Como posso ajudá-lo?`
      }
    ]);
    setShowChatDialog(true);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || sendingMessage) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setSendingMessage(true);

    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      // Buscar produtos do fabricante
      const allProducts = await base44.entities.Product.list();
      const products = allProducts.filter(
        p => p.fabricante_id === selectedFabricante.id && p.aprovado_produto === true && p.ativo !== false
      );

      // Buscar base de conhecimento
      const allKnowledge = await base44.entities.AIKnowledge.filter({ 
        fabricante_id: selectedFabricante.id,
        ativo: true
      });
      
      const knowledgeContext = allKnowledge.length > 0 ? `
═══════════════════════════════════════════════════════════════
📖 BASE DE CONHECIMENTO ADICIONAL:
═══════════════════════════════════════════════════════════════

${allKnowledge.map((k, i) => `
CONHECIMENTO ${i + 1} - ${k.categoria}: ${k.titulo}
${k.conteudo}
`).join('\n')}
` : '';

      // Buscar histórico de conversas aprovadas
      const allHistory = await base44.entities.ChatHistory.filter({
        fabricante_id: selectedFabricante.id
      });
      
      const approvedHistory = allHistory.filter(h => 
        h.feedback === "aprovado" || h.correcao
      );
      
      const trainingContext = approvedHistory.length > 0 ? `
═══════════════════════════════════════════════════════════════
📚 EXEMPLOS DE RESPOSTAS APROVADAS (APRENDIZADO):
═══════════════════════════════════════════════════════════════

${approvedHistory.map((h, i) => `
EXEMPLO ${i + 1}:
PERGUNTA: ${h.user_message}
RESPOSTA CORRETA: ${h.correcao || h.agent_response}
${h.observacoes ? `OBSERVAÇÃO: ${h.observacoes}` : ''}
`).join('\n---\n')}
` : '';

      // Criar lista completa de produtos
      const productsFullList = products.map((p, idx) => {
        const details = [];
        details.push(`CÓDIGO: ${p.cod}`);
        details.push(`NOME: ${p.nome}`);
        details.push(`CATEGORIA: ${p.categoria}`);
        details.push(`UNIDADE: ${p.und}`);
        if (p.peso) details.push(`PESO: ${p.peso}kg`);
        if (p.dimensoes) details.push(`DIMENSÕES: ${p.dimensoes}`);
        if (p.preco_fabricante) details.push(`PREÇO: R$ ${parseFloat(p.preco_fabricante).toFixed(2)}`);
        if (p.foto) details.push(`FOTO DISPONÍVEL: ${p.foto}`);
        
        return `
═══════════════════════════════════════════════════════════════
PRODUTO #${idx + 1}:
═══════════════════════════════════════════════════════════════
${details.map(d => `  ${d}`).join('\n')}
`;
      }).join('\n');

      const systemContext = `
Você é o agente de vendas virtual da ${selectedFabricante.empresa || selectedFabricante.full_name}, fabricante de equipamentos fitness.

${selectedFabricante.instrucoes_agente_ia ? `
═══════════════════════════════════════════════════════════════
🎯 INSTRUÇÕES CUSTOMIZADAS PRIORITÁRIAS:
═══════════════════════════════════════════════════════════════

${selectedFabricante.instrucoes_agente_ia}

⚠️ IMPORTANTE: Estas instruções têm PRIORIDADE sobre as regras padrão.
` : ''}

${trainingContext}

${knowledgeContext}

═══════════════════════════════════════════════════════════════
🏭 INFORMAÇÕES DA EMPRESA:
═══════════════════════════════════════════════════════════════

FABRICANTE: ${selectedFabricante.empresa || selectedFabricante.full_name}
${selectedFabricante.whatsapp ? `WHATSAPP: ${selectedFabricante.whatsapp}` : ''}
${selectedFabricante.email ? `EMAIL: ${selectedFabricante.email}` : ''}
${selectedFabricante.site ? `WEBSITE: ${selectedFabricante.site}` : ''}
${selectedFabricante.endereco ? `ENDEREÇO: ${selectedFabricante.endereco}` : ''}
${selectedFabricante.formas_pagamento ? `\n💳 FORMAS DE PAGAMENTO:\n${selectedFabricante.formas_pagamento}` : ''}
${selectedFabricante.prazo_entrega ? `\n🚚 PRAZO DE ENTREGA:\n${selectedFabricante.prazo_entrega}` : ''}
${selectedFabricante.politica_troca ? `\n🔄 POLÍTICA DE TROCA:\n${selectedFabricante.politica_troca}` : ''}
${selectedFabricante.historia_empresa ? `\n📋 SOBRE A EMPRESA:\n${selectedFabricante.historia_empresa}` : ''}

═══════════════════════════════════════════════════════════════
⚠️ INSTRUÇÕES CRÍTICAS - VOCÊ É UM AGENTE DE VENDAS:
═══════════════════════════════════════════════════════════════

1. 🎯 SUA MISSÃO:
   • Você representa EXCLUSIVAMENTE a ${selectedFabricante.empresa || selectedFabricante.full_name}
   • Atenda clientes interessados em fazer orçamentos
   • Seja proativo, profissional e prestativo
   • Destaque a qualidade e diferenciais dos produtos

2. 💰 ORÇAMENTOS:
   • Quando um cliente pedir orçamento:
     ➜ Liste os produtos solicitados com códigos, nomes e preços
     ➜ Calcule o valor total do orçamento
     ➜ Informe condições de pagamento e entrega (se disponível)
     ➜ Pergunte a quantidade desejada de cada item
   
3. 📋 TABELA DE PRODUTOS:
   • Você tem ${products.length} produtos cadastrados
   • SEMPRE busque na lista completa abaixo
   • Para cada produto, você tem: código, nome, categoria, unidade, peso, dimensões, preço e FOTO (quando disponível)
   • Se o cliente perguntar sobre disponibilidade, consulte a lista

4. 💼 PROFISSIONALISMO:
   • Seja cordial e profissional
   • Responda de forma clara e objetiva
   • Destaque os benefícios dos produtos
   • Incentive o fechamento de negócio
   • Ofereça suporte para dúvidas técnicas

═══════════════════════════════════════════════════════════════
📦 BASE DE DADOS COMPLETA - ${products.length} PRODUTOS:
═══════════════════════════════════════════════════════════════

${productsFullList}

RESPONDA EM PORTUGUÊS BRASILEIRO DE FORMA PROFISSIONAL E COMERCIAL.
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemContext}\n\n════════════════════════════════════════════════════════════════\n💬 MENSAGEM DO CLIENTE:\n════════════════════════════════════════════════════════════════\n\n${userMessage}\n\n════════════════════════════════════════════════════════════════\n⚠️ INSTRUÇÕES DE FORMATAÇÃO:\n════════════════════════════════════════════════════════════════\n\nSe a resposta envolver LISTAR PRODUTOS, siga este formato HTML:\n\n<h3>📦 Produtos Disponíveis</h3>\n<table>\n<tr><th>Código</th><th>Produto</th><th>Unidade</th><th>Especificações</th><th>Preço</th></tr>\n<tr><td>COD-001</td><td>Nome do Produto</td><td>peça</td><td>Peso/Dim</td><td>R$ 000,00</td></tr>\n</table>\n\n<p>Observações adicionais em parágrafos normais.</p>\n\nSe for ORÇAMENTO, use este formato:\n\n<h3>💰 Orçamento</h3>\n<table>\n<tr><th>Item</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th></tr>\n<tr><td>Produto 1</td><td>10</td><td>R$ 100,00</td><td>R$ 1.000,00</td></tr>\n</table>\n<p><strong>Total: R$ 1.000,00</strong></p>\n\nVocê representa a ${selectedFabricante.empresa || selectedFabricante.full_name}.\nSeja profissional, cordial e sempre use HTML para tabelas quando listar produtos ou valores.`,
      });

      const assistantMessage = typeof response === 'string' ? response : response.response || "Desculpe, não consegui processar sua pergunta.";

      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: assistantMessage
      }]);

      // Salvar histórico
      await base44.entities.ChatHistory.create({
        fabricante_id: selectedFabricante.id,
        fabricante_nome: selectedFabricante.empresa || selectedFabricante.full_name,
        user_message: userMessage,
        agent_response: assistantMessage,
        feedback: "pendente"
      });

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." 
      }]);
    }

    setSendingMessage(false);
  };

  const openCatalogo = async (fabricante) => {
    setSelectedFabricante(fabricante);
    setShowCatalogoDialog(true);
    setLoadingCatalogo(true);

    try {
      const res = await getProdutosData({ mode: "catalogo" });
      const data = res.data || res;
      const templates = expandTemplates(data.templates || [], data.fieldMap);
      const pricesByProduct = data.pricesByProduct || {};

      const fabNome = fabricante.nome_fantasia || fabricante.razao_social || fabricante.empresa || fabricante.full_name;
      const fabNorm = normalizeName(fabNome);

      const matchingTemplates = templates.filter(tmpl => {
        const prices = pricesByProduct[tmpl.id] || [];
        return prices.some(p => {
          const pNorm = normalizeName(p && p.fabricante_nome);
          if (!fabNorm || !pNorm) return false;
          return fabNorm.includes(pNorm) || pNorm.includes(fabNorm);
        });
      });

      const groupsMap = new Map();
      for (const tmpl of matchingTemplates) {
        const key = tblKey(tmpl);
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            baseName: tblBase(tmpl),
            categoria: tmpl.categoria,
            dims: [],
            fotos: [],
            weights: [],
            sizes: new Set(),
          });
        }
        const g = groupsMap.get(key);
        if (tmpl.foto && !tmpl.foto.includes("placefit.com.br/produtos") && !g.fotos.includes(tmpl.foto)) {
          g.fotos.push(tmpl.foto);
        }
        const dm = tblDims(tmpl);
        if (dm && !g.dims.includes(dm)) g.dims.push(dm);
        const w = tmpl.peso_kg != null ? tmpl.peso_kg : extractWeightFromName(tmpl.nome);
        if (w != null && !g.weights.includes(w) && !(dm && g.weights.length === 0 && false)) {
          g.weights.push(w);
        }
        for (const sz of extractSizesFromName(tmpl.nome)) {
          g.sizes.add(sz);
        }
      }
      for (const g of groupsMap.values()) {
        g.weights.sort((a, b) => a - b);
        g.sizes = [...g.sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
      }

      setCatalogoProducts([...groupsMap.values()]);
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o catálogo.",
        variant: "destructive",
      });
    }
    setLoadingCatalogo(false);
  };

  const openPerfil = (fabricante) => {
    setSelectedFabricante(fabricante);
    setShowPerfilDialog(true);
  };

  const catalogoByCategory = (() => {
    const map = new Map();
    for (const g of catalogoProducts) {
      const cat = g.categoria || "Outros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
            Fabricantes Parceiros
          </h1>
          <p className="text-gray-600">
            Acesse catálogos, tabelas de preços e atendimento personalizado
          </p>
        </div>

        {/* Busca e Refresh */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Buscar fabricantes por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200 h-12"
            />
          </div>
          <Button
            onClick={() => loadData(true)}
            variant="outline"
            className="h-12 px-6"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </>
            )}
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total de Fabricantes</p>
                  <p className="text-3xl font-bold text-blue-900">{filteredFabricantes.length}</p>
                </div>
                <Store className="w-12 h-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid de Fabricantes */}
        {filteredFabricantes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFabricantes.map((fabricante) => (
              <Card key={fabricante.id} className="bg-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    {fabricante.logomarca ? (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 flex-shrink-0">
                        <img
                          src={fabricante.logomarca}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1 line-clamp-2">
                        {fabricante.empresa || fabricante.full_name}
                      </CardTitle>
                      {fabricante.cnpj && (
                        <p className="text-xs text-gray-500">CNPJ: {fabricante.cnpj}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fabricante.endereco && (
                    <p className="text-sm text-gray-600 line-clamp-2">{fabricante.endereco}</p>
                  )}
                  
                  {fabricante.whatsapp && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        📱 {fabricante.whatsapp}
                      </Badge>
                    </div>
                  )}

                  <Button
                    onClick={() => openPerfil(fabricante)}
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-blue-600 hover:text-blue-700 text-xs"
                  >
                    Ver perfil completo da empresa →
                  </Button>

                  <div className="grid grid-cols-1 gap-2 pt-3">
                    <Button
                      onClick={() => downloadFabricanteTable(fabricante)}
                      disabled={downloadingTable === fabricante.id}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {downloadingTable === fabricante.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          Baixando...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Tabela
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => openChat(fabricante)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Atendimento IA
                    </Button>

                    <Button
                      onClick={() => openCatalogo(fabricante)}
                      className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                      size="sm"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Ver Catálogo
                    </Button>

                    <ComissaoConfig
                      fabricanteNome={fabricante.empresa || fabricante.full_name}
                      fabricanteId={fabricante.id}
                      revendedorId={user?.id}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum fabricante encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm
                  ? "Tente ajustar os termos de busca."
                  : "Não há fabricantes aprovados no momento."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Chat */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Atendimento IA - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <AIResponseFormatter content={msg.content} />
                  )}
                </div>
              </div>
            ))}
            {sendingMessage && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              disabled={sendingMessage}
            />
            <Button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || sendingMessage}
              className="bg-gradient-to-r from-blue-600 to-green-600"
            >
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Catálogo */}
      <Dialog open={showCatalogoDialog} onOpenChange={setShowCatalogoDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto catalogo-dialog-content">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #catalogo-print-area, #catalogo-print-area * { visibility: visible; }
              .catalogo-dialog-content { position: static !important; transform: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
              #catalogo-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; background: #fff !important; }
              .no-print { display: none !important; }
              #catalogo-print-area .grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
              #catalogo-print-area .grid > * { page-break-inside: avoid; break-inside: avoid; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `}</style>
          <DialogHeader className="no-print">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>
                Catálogo - {selectedFabricante?.nome_fantasia || selectedFabricante?.razao_social || selectedFabricante?.empresa || selectedFabricante?.full_name}
              </DialogTitle>
              <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5">
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </DialogHeader>

          {loadingCatalogo ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando catálogo...</p>
            </div>
          ) : catalogoProducts.length > 0 ? (
            <div id="catalogo-print-area" className="space-y-6">
              {/* Cabeçalho do fabricante */}
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-gray-50">
                {selectedFabricante?.logomarca && (
                  <div className="w-16 h-16 bg-white rounded-lg p-2 flex-shrink-0 flex items-center justify-center">
                    <img src={selectedFabricante.logomarca} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedFabricante?.nome_fantasia || selectedFabricante?.razao_social || selectedFabricante?.empresa || selectedFabricante?.full_name}
                  </h3>
                  {selectedFabricante?.cnpj && <p className="text-xs text-gray-600">CNPJ: {selectedFabricante.cnpj}</p>}
                  {selectedFabricante?.endereco && <p className="text-xs text-gray-600">{selectedFabricante.endereco}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
                    {selectedFabricante?.whatsapp && <span>📱 {selectedFabricante.whatsapp}</span>}
                    {selectedFabricante?.site && <span>🌐 {selectedFabricante.site}</span>}
                    {selectedFabricante?.email && <span>✉ {selectedFabricante.email}</span>}
                  </div>
                </div>
              </div>

              {/* Categorias */}
              {catalogoByCategory.map(([cat, items]) => (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-gray-900">{cat}</h4>
                    <Badge variant="outline" className="text-xs">{items.length} {items.length === 1 ? "produto" : "produtos"}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((group) => (
                      <Card key={group.key} className="bg-white">
                        <CardContent className="p-3 flex gap-3 items-start">
                          <div className="w-28 h-28 flex-shrink-0 bg-white rounded-lg overflow-hidden flex items-center justify-center">
                            <FamilyPhoto
                              candidates={group.fotos}
                              alt={group.baseName}
                              className="w-28 h-28 object-contain bg-white"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-sm line-clamp-2">{group.baseName}</h5>
                            {group.categoria && <p className="text-xs text-gray-500 mb-1">{group.categoria}</p>}
                            {(group.dims.length > 0 || group.weights.length > 0 || group.sizes.length > 0) && (
                              <div className="flex flex-wrap gap-1">
                                {group.dims.map(d => (
                                  <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                                    {d}
                                  </span>
                                ))}
                                {group.weights.map(w => (
                                  <span key={w} className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                                    {w} kg
                                  </span>
                                ))}
                                {group.sizes.map(s => (
                                  <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {/* Rodapé */}
              <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-medium text-gray-700">
                    {selectedFabricante?.nome_fantasia || selectedFabricante?.razao_social || selectedFabricante?.empresa || selectedFabricante?.full_name}
                  </span>
                  {selectedFabricante?.whatsapp && <span>📱 {selectedFabricante.whatsapp}</span>}
                  {selectedFabricante?.site && <span>🌐 {selectedFabricante.site}</span>}
                </div>
                <span>Catálogo gerado em {new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Este fabricante não possui produtos no catálogo.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Perfil */}
      <Dialog open={showPerfilDialog} onOpenChange={setShowPerfilDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedFabricante?.logomarca && (
                <img 
                  src={selectedFabricante.logomarca} 
                  alt="Logo" 
                  className="w-12 h-12 object-contain rounded-lg border p-1"
                />
              )}
              Perfil - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedFabricante && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações da Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.empresa && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Razão Social</p>
                      <p className="text-gray-900">{selectedFabricante.empresa}</p>
                    </div>
                  )}
                  {selectedFabricante.cnpj && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">CNPJ</p>
                      <p className="text-gray-900">{selectedFabricante.cnpj}</p>
                    </div>
                  )}
                  {selectedFabricante.endereco && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Endereço</p>
                      <p className="text-gray-900">{selectedFabricante.endereco}</p>
                    </div>
                  )}
                  {selectedFabricante.historia_empresa && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Sobre a Empresa</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.historia_empresa}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contatos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contatos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.email && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">E-mail</p>
                      <p className="text-gray-900">{selectedFabricante.email}</p>
                    </div>
                  )}
                  {selectedFabricante.whatsapp && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">WhatsApp</p>
                      <p className="text-gray-900">{selectedFabricante.whatsapp}</p>
                    </div>
                  )}
                  {selectedFabricante.site && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Website</p>
                      <a 
                        href={selectedFabricante.site} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedFabricante.site}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Políticas e Condições */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Políticas e Condições Comerciais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.formas_pagamento && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Formas de Pagamento</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.formas_pagamento}</p>
                    </div>
                  )}
                  {selectedFabricante.prazo_entrega && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Prazo de Entrega</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.prazo_entrega}</p>
                    </div>
                  )}
                  {selectedFabricante.politica_troca && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Política de Troca</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.politica_troca}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}