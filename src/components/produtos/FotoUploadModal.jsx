import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload, ImageIcon, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const GROUP_FIELDS = [
  'categoria', 'subcategoria', 'tipo_anilha', 'tipo_furo', 'acabamento',
  'barra_tipo', 'barra_acabamento', 'bojo_formato', 'dumbell_tipo',
  'piso_espessura_mm', 'piso_formato', 'tijolinho_tipo', 'tijolinho_torre',
  'suporte_modelo', 'suporte_estrutura', 'suporte_degraus',
  'suporte_capacidade_pares', 'suporte_capacidade_unidades',
  'suporte_torre_capacidade', 'suporte_torre_tipo',
  'pegada', 'peso_faixa'
];

const getGroupKey = (tmpl) => GROUP_FIELDS.map(f => tmpl[f] ?? '').join('|');

export default function FotoUploadModal({ template, allTemplates, onClose, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(template?.foto || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Find all templates in the same group (variations)
  const variations = (allTemplates || []).filter(t => getGroupKey(t) === getGroupKey(template));

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPreviewUrl(file_url);
      toast({ title: "Imagem carregada", description: "Clique em Salvar para aplicar a todas as variações." });
    } catch (err) {
      toast({ title: "Erro", description: "Falha ao enviar imagem.", variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!previewUrl) {
      toast({ title: "Selecione uma imagem", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updates = variations.map(v => ({ id: v.id, foto: previewUrl }));
      if (updates.length > 0) {
        await base44.entities.ProductTemplate.bulkUpdate(updates);
      }
      toast({ title: "Imagem salva!", description: `Aplicada a ${updates.length} ${updates.length === 1 ? "variação" : "variações"} do produto.` });
      onSaved();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.message || "Falha ao salvar imagem.";
      toast({ title: "Erro ao salvar imagem", description: errMsg, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const updates = variations.map(v => ({ id: v.id, foto: "" }));
      if (updates.length > 0) {
        await base44.entities.ProductTemplate.bulkUpdate(updates);
      }
      toast({ title: "Imagem removida", description: `${updates.length} ${updates.length === 1 ? "variação" : "variações"} atualizadas.` });
      onSaved();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.message || "Falha ao remover imagem.";
      toast({ title: "Erro ao remover imagem", description: errMsg, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="bg-blue-50 rounded-lg p-3">
        <p className="font-semibold text-sm text-blue-900">{template?.nome}</p>
        <p className="text-xs text-blue-700 mt-0.5">
          {variations.length} {variations.length === 1 ? "variação encontrada" : "variações encontradas"} — a imagem será aplicada a todas.
        </p>
      </div>

      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        {previewUrl ? (
          <div className="relative">
            <img src={previewUrl} alt="Preview" className="w-32 h-32 rounded-xl object-cover border-2 border-gray-200" />
            <button
              onClick={() => setPreviewUrl("")}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="w-10 h-10 mb-1" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}
      </div>

      {/* Upload */}
      <div>
        <Label className="mb-2 block">Selecionar imagem do produto</Label>
        <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg py-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Enviando...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Clique para escolher uma imagem</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading || saving}
          />
        </label>
        <p className="text-xs text-gray-500 mt-1">Formatos: JPG, PNG, WebP. A mesma imagem será usada em todas as variações de peso.</p>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        {template?.foto && (
          <Button variant="outline" onClick={handleRemove} disabled={saving || uploading} className="text-red-600 border-red-200 hover:bg-red-50">
            Remover Imagem
          </Button>
        )}
        <div className="flex gap-3 ml-auto">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading || !previewUrl}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}