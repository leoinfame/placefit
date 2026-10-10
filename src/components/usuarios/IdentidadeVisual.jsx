import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Palette, Save, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { renderCardImagem, sugerirCoresDaLogo } from "@/lib/cardRender";
import { hexValido, resolverPaleta, COR_PRINCIPAL_PADRAO, COR_SECUNDARIA_PADRAO } from "@/lib/cardCores";

const ESTILOS = [
  { id: "gradiente", titulo: "Gradiente", desc: "com a cor principal" },
  { id: "claro", titulo: "Claro", desc: "fundo branco" },
  { id: "escuro", titulo: "Escuro", desc: "fundo quase preto" },
  { id: "neutro", titulo: "Cinza neutro", desc: "fundo cinza" },
];

const slugify = (t) =>
  String(t || "loja").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "loja";

// Identidade visual do revendedor para o card de produto (salva na LojaConfig).
// Campos estruturados porque o card padrao e deterministico; a descricao livre
// fica guardada para a camada artistica futura e nao entra no card padrao.
export default function IdentidadeVisual({ user, logoUrl }) {
  const { toast } = useToast();
  const [loja, setLoja] = useState(null);
  const [form, setForm] = useState(null);
  const [sugestao, setSugestao] = useState(null);
  const [pacote, setPacote] = useState(null);
  const [aviso, setAviso] = useState("");
  const [previa, setPrevia] = useState(null);
  const [gerandoPrevia, setGerandoPrevia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const urlAnterior = useRef(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const lojas = await base44.entities.LojaConfig.filter({ revendedor_id: user.id }).catch(() => []);
      const l = lojas?.[0] || null;
      let pac = null;
      try {
        const r = await base44.functions.invoke("gerarCardProduto", { acao: "previa" });
        pac = r.data;
      } catch (e) {
        setAviso(e?.response?.data?.error || "Não foi possível carregar um produto para a prévia.");
      }
      const sug = await sugerirCoresDaLogo(pac?.imagens?.logo || logoUrl || null).catch(() => null);
      if (!ativo) return;
      setLoja(l);
      setPacote(pac);
      setSugestao(sug);
      const lojaTemCores = l && hexValido(l.cor_primaria) && !(l.cor_primaria === COR_PRINCIPAL_PADRAO && l.cor_secundaria === COR_SECUNDARIA_PADRAO);
      setForm({
        cor_primaria: (l?.identidade_configurada || lojaTemCores) && hexValido(l?.cor_primaria) ? l.cor_primaria : sug?.principal || COR_PRINCIPAL_PADRAO,
        cor_secundaria: (l?.identidade_configurada || lojaTemCores) && hexValido(l?.cor_secundaria) ? l.cor_secundaria : sug?.secundaria || COR_SECUNDARIA_PADRAO,
        estilo_fundo: l?.identidade_configurada && l?.estilo_fundo ? l.estilo_fundo : "gradiente",
        identidade_descricao: l?.identidade_descricao || "",
      });
    })();
    return () => { ativo = false; };
  }, [user.id]);

  // Miniatura do card com as escolhas (antes de salvar)
  useEffect(() => {
    if (!form || !hexValido(form.cor_primaria) || !hexValido(form.cor_secundaria)) return;
    const t = setTimeout(async () => {
      setGerandoPrevia(true);
      try {
        const base = pacote || {
          dados: { nome: "Seu produto aqui", peso_kg: null, und: "peça", preco_texto: "R$ 199,90", peso_texto: null, marca: { nome: user.empresa || user.full_name || "", whatsapp: user.whatsapp || null } },
          imagens: {},
        };
        const pac = { ...base, dados: { ...base.dados, marca: { ...base.dados.marca, cor_primaria: form.cor_primaria, cor_secundaria: form.cor_secundaria, estilo_fundo: form.estilo_fundo } } };
        const blob = await renderCardImagem(pac, "quadrado");
        const url = URL.createObjectURL(blob);
        if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
        urlAnterior.current = url;
        setPrevia(url);
      } catch (e) {
        console.warn("prévia da identidade falhou", e);
      }
      setGerandoPrevia(false);
    }, 350);
    return () => clearTimeout(t);
  }, [form?.cor_primaria, form?.cor_secundaria, form?.estilo_fundo, pacote]);

  useEffect(() => () => { if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current); }, []);

  const salvar = async () => {
    if (!hexValido(form.cor_primaria) || !hexValido(form.cor_secundaria)) {
      toast({ title: "Cor inválida", description: "Use o formato #RRGGBB.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        cor_primaria: form.cor_primaria.toLowerCase(),
        cor_secundaria: form.cor_secundaria.toLowerCase(),
        estilo_fundo: form.estilo_fundo,
        identidade_descricao: form.identidade_descricao.trim().slice(0, 280),
        identidade_configurada: true,
        ...(!loja?.logo_url && logoUrl ? { logo_url: logoUrl } : {}),
      };
      if (loja) {
        await base44.entities.LojaConfig.update(loja.id, dados);
        setLoja({ ...loja, ...dados });
      } else {
        // sem loja ainda: cria uma desativada so para guardar a identidade
        const nova = await base44.entities.LojaConfig.create({
          revendedor_id: user.id,
          nome_loja: user.empresa || user.full_name || "Minha loja",
          slug: `${slugify(user.empresa || user.full_name)}-${Math.random().toString(36).slice(2, 6)}`,
          ativo: false,
          ...dados,
        });
        setLoja(nova);
      }
      toast({ title: "Identidade visual salva", description: "Os próximos cards já usam essas escolhas." });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e?.message || "Tente de novo.", variant: "destructive" });
    }
    setSalvando(false);
  };

  if (!form) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando identidade visual...
        </CardContent>
      </Card>
    );
  }

  const set = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }));
  const paletaAtual = resolverPaleta({ principal: form.cor_primaria, secundaria: form.cor_secundaria, estilo: form.estilo_fundo });

  const CampoCor = ({ id, label, campo, dica }) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          id={id}
          type="color"
          value={hexValido(form[campo]) ? form[campo] : "#000000"}
          onChange={(e) => set(campo)(e.target.value)}
          className="h-10 w-14 rounded border cursor-pointer bg-white"
        />
        <Input value={form[campo]} onChange={(e) => set(campo)(e.target.value.trim())} className="w-32 font-mono" maxLength={7} />
      </div>
      {dica && <p className="text-xs text-gray-500 mt-1">{dica}</p>}
    </div>
  );

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" /> Identidade visual
        </CardTitle>
        <p className="text-sm text-gray-500">Cores e fundo usados nas imagens de produto para Instagram e WhatsApp.</p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              {CampoCor({ id: "cor-principal", label: "Cor principal", campo: "cor_primaria", dica: "Fundo e preço" })}
              {CampoCor({ id: "cor-secundaria", label: "Cor de detalhe", campo: "cor_secundaria", dica: "Selo de peso e detalhes" })}
            </div>
            {sugestao && (
              <Button type="button" variant="ghost" size="sm" className="px-0 text-blue-700"
                onClick={() => setForm((f) => ({ ...f, cor_primaria: sugestao.principal, cor_secundaria: sugestao.secundaria }))}>
                <RotateCcw className="w-4 h-4 mr-1" /> Usar as cores da minha logo
                <span className="inline-block w-4 h-4 rounded ml-2 border" style={{ background: sugestao.principal }} />
                <span className="inline-block w-4 h-4 rounded ml-1 border" style={{ background: sugestao.secundaria }} />
              </Button>
            )}

            <div>
              <Label>Estilo de fundo</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ESTILOS.map((e) => {
                  const p = resolverPaleta({ principal: form.cor_primaria, secundaria: form.cor_secundaria, estilo: e.id });
                  return (
                    <button key={e.id} type="button" onClick={() => set("estilo_fundo")(e.id)}
                      className={`rounded-lg border p-2.5 text-left flex items-center gap-2 transition ${form.estilo_fundo === e.id ? "border-blue-500 ring-1 ring-blue-200 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                      <span className="w-8 h-8 rounded-md border flex-shrink-0"
                        style={{ background: `radial-gradient(circle, ${p.paradas[0]}, ${p.paradas[1]} 55%, ${p.paradas[2]})` }} />
                      <span>
                        <span className="block text-sm font-semibold">{e.titulo}</span>
                        <span className="block text-[11px] text-gray-500">{e.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="identidade-descricao">Descrição da identidade (opcional)</Label>
              <Textarea id="identidade-descricao" rows={2} maxLength={280} className="mt-1"
                placeholder="Ex.: academia raiz, pesada, tons escuros"
                value={form.identidade_descricao} onChange={(e) => set("identidade_descricao")(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Não aparece no card padrão. Fica guardada para o card artístico (em breve).</p>
            </div>

            <Button type="button" onClick={salvar} disabled={salvando}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white">
              {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar identidade visual
            </Button>
          </div>

          <div>
            <Label>Prévia do card</Label>
            <div className="mt-1 relative aspect-square w-full max-w-[320px] rounded-lg border overflow-hidden" style={{ background: paletaAtual.base }}>
              {previa && <img src={previa} alt="Prévia do card com a identidade escolhida" className="w-full h-full object-contain" />}
              {gerandoPrevia && (
                <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1"><Loader2 className="w-4 h-4 animate-spin text-gray-600" /></div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">{aviso || "Exemplo com um dos seus produtos. O contraste dos textos é ajustado automaticamente."}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
