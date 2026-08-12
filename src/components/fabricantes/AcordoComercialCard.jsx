import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Percent, Save, Edit3, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AcordoComercialCard({ fabricante }) {
  const [acordo, setAcordo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo_remuneracao: "comissao",
    percentual: "",
    desconto_tabela: "",
    observacoes: "",
  });
  const { toast } = useToast();

  const loadAcordo = async () => {
    if (!fabricante?.id) return;
    setLoading(true);
    try {
      const list = await base44.entities.AcordoFabricante.filter({
        fabricante_id: fabricante.id,
      });
      const ativo = list.find((a) => a.ativo !== false) || list[0] || null;
      setAcordo(ativo);
      if (ativo) {
        setForm({
          tipo_remuneracao: ativo.tipo_remuneracao || "comissao",
          percentual: ativo.percentual ?? "",
          desconto_tabela: ativo.desconto_tabela ?? "",
          observacoes: ativo.observacoes || "",
        });
      } else {
        setForm({
          tipo_remuneracao: "comissao",
          percentual: "",
          desconto_tabela: "",
          observacoes: "",
        });
      }
    } catch (e) {
      console.error("Erro ao carregar acordo:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAcordo();
  }, [fabricante?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        fabricante_id: fabricante.id,
        fabricante_nome: fabricante.nome_fantasia || fabricante.razao_social,
        tipo_remuneracao: form.tipo_remuneracao,
        percentual: parseFloat(form.percentual) || 0,
        desconto_tabela: parseFloat(form.desconto_tabela) || 0,
        observacoes: form.observacoes || "",
        ativo: true,
      };
      if (acordo?.id) {
        await base44.entities.AcordoFabricante.update(acordo.id, payload);
      } else {
        const created = await base44.entities.AcordoFabricante.create(payload);
        setAcordo(created);
      }
      setEditing(false);
      toast({
        title: "Acordo salvo!",
        description: "Condições comerciais atualizadas com sucesso.",
      });
    } catch (e) {
      console.error("Erro ao salvar acordo:", e);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o acordo.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const tipoLabel = (t) => (t === "margem" ? "Margem" : "Comissão");
  const tipoColor = (t) =>
    t === "margem"
      ? "bg-blue-100 text-blue-700"
      : "bg-purple-100 text-purple-700";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Acordo Comercial (PlaceFit)
          </CardTitle>
          {!editing && !loading && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              {acordo ? "Editar" : "Definir"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Remuneração *</Label>
                <Select
                  value={form.tipo_remuneracao}
                  onValueChange={(v) =>
                    setForm({ ...form, tipo_remuneracao: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comissao">Comissão</SelectItem>
                    <SelectItem value="margem">Margem</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {form.tipo_remuneracao === "margem"
                    ? "PlaceFit aplica uma margem sobre o preço de fábrica."
                    : "Fabricante paga comissão sobre a venda."}
                </p>
              </div>
              <div>
                <Label>
                  {form.tipo_remuneracao === "margem" ? "Margem %" : "Comissão %"} *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.percentual}
                  onChange={(e) =>
                    setForm({ ...form, percentual: e.target.value })
                  }
                  placeholder="Ex: 10"
                />
              </div>
              <div>
                <Label>Desconto da tabela (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.desconto_tabela}
                  onChange={(e) =>
                    setForm({ ...form, desconto_tabela: e.target.value })
                  }
                  placeholder="Ex: 15"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Desconto aplicado sobre a tabela original no cadastro.
                </p>
              </div>
            </div>
            <div>
              <Label>Observações internas</Label>
              <Input
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="Notas sobre a negociação"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  loadAcordo();
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !form.percentual}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        ) : acordo ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Tipo</Label>
              <div className="mt-1">
                <Badge className={tipoColor(acordo.tipo_remuneracao)}>
                  {tipoLabel(acordo.tipo_remuneracao)}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                {acordo.tipo_remuneracao === "margem" ? "Margem" : "Comissão"}
              </Label>
              <p className="font-bold text-lg text-gray-900">
                {acordo.percentual ?? 0}%
              </p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                Desconto da tabela
              </Label>
              <p className="font-bold text-lg text-gray-900">
                {acordo.desconto_tabela ?? 0}%
              </p>
            </div>
            {acordo.observacoes && (
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs text-gray-500">Observações</Label>
                <p className="text-sm text-gray-700">{acordo.observacoes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-1">
              Nenhum acordo comercial definido para este fabricante.
            </p>
            <p className="text-xs text-gray-400">
              Clique em "Definir" para configurar comissão ou margem.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}