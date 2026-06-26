import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIAS = [
  "Anilhas",
  "Halteres",
  "Dumbells",
  "Barras Montadas",
  "Tijolinhos",
  "Pisos",
  "Kettlebells",
  "Suportes",
  "Outros",
];

const UNIDADES = ["peça", "par", "kg", "m²", "kit"];

// Default options per field (used as fallback if no AtributoConfig exists)
const DEFAULT_OPCOES = {
  tipo_anilha: ["Vazada", "Injetada", "Sólida", "Bumper", "N/A"],
  acabamento: ["Bruto", "Pintado", "Emborrachado", "Injetado", "Bumper", "Cromado", "N/A"],
  tipo_furo: ["Normal (Furo Pequeno)", "Olímpico (Furo 50mm)", "N/A"],
  bojo_formato: ["Sextavado (Hexagonal)", "Bola", "Redondo", "N/A"],
  barra_tipo: ["Reta", "W (Curvada)", "N/A"],
  barra_acabamento: ["Cromado Recartilhado", "Pintado", "Injetado", "N/A"],
  dumbell_tipo: ["Monobloco", "Anilhas Montadas", "N/A"],
  piso_formato: ["1x1m (Peça única)", "4x 50x50cm (Modular)", "N/A"],
  tijolinho_tipo: ["Padrão", "Guia (Primeiro da pilha)", "N/A"],
  tijolinho_torre: ["5kg", "10kg", "N/A"],
  suporte_modelo: ["Sextavado", "Anilhas Montadas (com calço)", "N/A"],
  suporte_estrutura: ["Monobloco", "Desmontável", "N/A"],
  suporte_torre_capacidade: ["5 pares", "10 pares", "N/A"],
  suporte_torre_tipo: ["Chapa Laser", "Personalizado", "N/A"],
};

// Which fields are relevant per category
const CAMPOS_POR_CATEGORIA = {
  Anilhas: ["tipo_anilha", "peso_kg", "acabamento", "tipo_furo", "peso_fracionado"],
  Halteres: ["peso_kg", "acabamento", "bojo_formato", "barra_acabamento"],
  Dumbells: ["peso_kg", "acabamento", "bojo_formato", "dumbell_tipo"],
  "Barras Montadas": ["peso_kg", "barra_tipo", "barra_acabamento"],
  Tijolinhos: ["tijolinho_tipo", "tijolinho_torre"],
  Pisos: ["piso_espessura_mm", "piso_formato"],
  Kettlebells: ["peso_kg", "acabamento"],
  Suportes: [
    "subcategoria",
    "suporte_capacidade_pares",
    "suporte_capacidade_unidades",
    "suporte_modelo",
    "suporte_estrutura",
    "suporte_degraus",
    "suporte_torre_capacidade",
    "suporte_torre_tipo",
  ],
  Outros: ["subcategoria"],
};

const CAMPO_LABELS = {
  tipo_anilha: "Tipo de Anilha",
  peso_kg: "Peso (kg)",
  acabamento: "Acabamento",
  tipo_furo: "Tipo de Furo",
  peso_fracionado: "Peso Fracionado (1.5kg, 2.5kg)",
  bojo_formato: "Bojo (Formato das extremidades)",
  barra_tipo: "Tipo de Barra",
  barra_acabamento: "Acabamento da Barra",
  dumbell_tipo: "Tipo de Dumbell",
  piso_espessura_mm: "Espessura do Piso (mm)",
  piso_formato: "Formato do Piso",
  tijolinho_tipo: "Tipo de Tijolinho",
  tijolinho_torre: "Torre Compatível",
  suporte_capacidade_pares: "Capacidade (pares)",
  suporte_capacidade_unidades: "Capacidade (unidades)",
  suporte_modelo: "Modelo do Suporte",
  suporte_estrutura: "Estrutura",
  suporte_degraus: "Degraus/Prateleiras",
  suporte_torre_capacidade: "Capacidade da Torre",
  suporte_torre_tipo: "Tipo da Torre",
  subcategoria: "Subcategoria",
};

const SELECT_FIELDS = [
  "tipo_anilha",
  "acabamento",
  "tipo_furo",
  "bojo_formato",
  "barra_tipo",
  "barra_acabamento",
  "dumbell_tipo",
  "piso_formato",
  "tijolinho_tipo",
  "tijolinho_torre",
  "suporte_modelo",
  "suporte_estrutura",
  "suporte_torre_capacidade",
  "suporte_torre_tipo",
];

const NUMBER_FIELDS = [
  "peso_kg",
  "piso_espessura_mm",
  "suporte_capacidade_pares",
  "suporte_capacidade_unidades",
  "suporte_degraus",
];

const BOOLEAN_FIELDS = ["peso_fracionado"];

const EMPTY_FORM = {
  nome: "",
  cod: "",
  categoria: "",
  und: "",
  subcategoria: "",
  tipo_anilha: "N/A",
  acabamento: "N/A",
  peso_kg: "",
  tipo_furo: "N/A",
  bojo_formato: "N/A",
  barra_tipo: "N/A",
  barra_acabamento: "N/A",
  dumbell_tipo: "N/A",
  peso_fracionado: false,
  piso_espessura_mm: "",
  piso_formato: "N/A",
  tijolinho_tipo: "N/A",
  tijolinho_torre: "N/A",
  suporte_capacidade_pares: "",
  suporte_capacidade_unidades: "",
  suporte_modelo: "N/A",
  suporte_estrutura: "N/A",
  suporte_degraus: "",
  suporte_torre_capacidade: "N/A",
  suporte_torre_tipo: "N/A",
  foto: "",
  google_category: "Sporting Goods > Exercise & Fitness",
  ncm: "9506.91.00",
  gtin: "",
  descricao_padrao: "",
  ativo: true,
};

export default function TemplateForm({
  open,
  editingTemplate,
  onSave,
  onClose,
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [opcoesCustom, setOpcoesCustom] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadAtributoConfig();
  }, []);

  useEffect(() => {
    if (editingTemplate) {
      setFormData({ ...EMPTY_FORM, ...editingTemplate });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [editingTemplate, open]);

  const loadAtributoConfig = async () => {
    try {
      const configs = await base44.entities.AtributoConfig.filter({ ativo: true });
      const custom = {};
      configs.forEach((c) => {
        if (c.opcoes && c.opcoes.length > 0) {
          custom[c.campo] = c.opcoes;
        }
      });
      setOpcoesCustom(custom);
    } catch (e) {
      // fallback to defaults
    }
  };

  const getOpcoes = (campo) => opcoesCustom[campo] || DEFAULT_OPCOES[campo] || [];

  const getCamposVisiveis = () => {
    if (!formData.categoria) return [];
    return CAMPOS_POR_CATEGORIA[formData.categoria] || [];
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInternalPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, foto: file_url }));
    } catch (err) {
      console.error("Erro no upload:", err);
    }
    setUploadingPhoto(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...formData };
    NUMBER_FIELDS.forEach((field) => {
      if (data[field] === "" || data[field] === null) {
        data[field] = null;
      } else {
        data[field] = parseFloat(data[field]);
      }
    });
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const renderCampo = (campo) => {
    const label = CAMPO_LABELS[campo] || campo;

    if (SELECT_FIELDS.includes(campo)) {
      return (
        <div key={campo}>
          <Label>{label}</Label>
          <Select
            value={formData[campo] || "N/A"}
            onValueChange={(v) => handleChange(campo, v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getOpcoes(campo).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (NUMBER_FIELDS.includes(campo)) {
      return (
        <div key={campo}>
          <Label>{label}</Label>
          <Input
            type="number"
            step="0.01"
            value={formData[campo] || ""}
            onChange={(e) => handleChange(campo, e.target.value)}
          />
        </div>
      );
    }

    if (BOOLEAN_FIELDS.includes(campo)) {
      return (
        <div key={campo} className="flex items-center gap-2 pt-6">
          <Switch
            id={campo}
            checked={!!formData[campo]}
            onCheckedChange={(v) => handleChange(campo, v)}
          />
          <Label htmlFor={campo}>{label}</Label>
        </div>
      );
    }

    // text field (subcategoria, etc.)
    return (
      <div key={campo}>
        <Label>{label}</Label>
        <Input
          value={formData[campo] || ""}
          onChange={(e) => handleChange(campo, e.target.value)}
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Campos base - sempre visíveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Nome *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Código (SKU) *</Label>
          <Input
            value={formData.cod}
            onChange={(e) => handleChange("cod", e.target.value)}
            required
            placeholder="ex: ANI-OLI-EMB-010"
          />
        </div>
        <div>
          <Label>Categoria *</Label>
          <Select
            value={formData.categoria}
            onValueChange={(v) => handleChange("categoria", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unidade *</Label>
          <Select
            value={formData.und}
            onValueChange={(v) => handleChange("und", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campos condicionais por categoria */}
      {formData.categoria && (
        <>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Atributos de {formData.categoria}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getCamposVisiveis().map((campo) => renderCampo(campo))}
            </div>
          </div>
        </>
      )}

      {/* Campos fiscais / Google */}
      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Dados Fiscais e Google Shopping
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Google Category</Label>
            <Input
              value={formData.google_category}
              onChange={(e) => handleChange("google_category", e.target.value)}
            />
          </div>
          <div>
            <Label>NCM</Label>
            <Input
              value={formData.ncm}
              onChange={(e) => handleChange("ncm", e.target.value)}
            />
          </div>
          <div>
            <Label>GTIN (Código de barras)</Label>
            <Input
              value={formData.gtin}
              onChange={(e) => handleChange("gtin", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="ativo"
              checked={!!formData.ativo}
              onCheckedChange={(v) => handleChange("ativo", v)}
            />
            <Label htmlFor="ativo">Ativo no catálogo</Label>
          </div>
        </div>
        <div className="mt-4">
          <Label>Descrição Padrão</Label>
          <Textarea
            value={formData.descricao_padrao}
            onChange={(e) => handleChange("descricao_padrao", e.target.value)}
            rows={2}
            placeholder="Descrição para Google Shopping e orçamentos"
          />
        </div>
      </div>

      {/* Foto */}
      <div>
        <Label>Foto do Template</Label>
        <div className="mt-2 space-y-3">
          {formData.foto && (
            <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={formData.foto}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex gap-2">
            <input
              id="foto-upload"
              type="file"
              accept="image/*"
              onChange={handleInternalPhotoUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("foto-upload")?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Upload de Foto
                </>
              )}
            </Button>
          </div>
          <Input
            type="url"
            value={formData.foto}
            onChange={(e) => handleChange("foto", e.target.value)}
            placeholder="Ou insira a URL da foto"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
        >
          {saving
            ? "Salvando..."
            : editingTemplate
            ? "Salvar Alterações"
            : "Criar Template"}
        </Button>
      </div>
    </form>
  );
}