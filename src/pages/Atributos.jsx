import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Settings, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIAS = [
  "Anilhas",
  "Halteres",
  "Dumbells",
  "Tijolinhos",
  "Pisos",
  "Kettlebells",
  "Outros",
];

export default function Atributos() {
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [newOpcao, setNewOpcao] = useState("");
  const [formData, setFormData] = useState({
    campo: "",
    label: "",
    tipo: "select",
    opcoes: [],
    categorias_aplicaveis: [],
    ordem: 0,
    ativo: true,
  });

  const { toast } = useToast();

  useEffect(() => {
    loadUser();
    loadConfigs();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== "admin") {
        window.location.href = "/Dashboard";
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadConfigs = async () => {
    try {
      const data = await base44.entities.AtributoConfig.list("ordem");
      setConfigs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAddOpcao = () => {
    if (!newOpcao.trim()) return;
    setFormData((prev) => ({
      ...prev,
      opcoes: [...prev.opcoes, newOpcao.trim()],
    }));
    setNewOpcao("");
  };

  const handleRemoveOpcao = (idx) => {
    setFormData((prev) => ({
      ...prev,
      opcoes: prev.opcoes.filter((_, i) => i !== idx),
    }));
  };

  const toggleCategoria = (cat) => {
    setFormData((prev) => ({
      ...prev,
      categorias_aplicaveis: prev.categorias_aplicaveis.includes(cat)
        ? prev.categorias_aplicaveis.filter((c) => c !== cat)
        : [...prev.categorias_aplicaveis, cat],
    }));
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      campo: config.campo || "",
      label: config.label || "",
      tipo: config.tipo || "select",
      opcoes: config.opcoes || [],
      categorias_aplicaveis: config.categorias_aplicaveis || [],
      ordem: config.ordem || 0,
      ativo: config.ativo !== false,
    });
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditingConfig(null);
    setFormData({
      campo: "",
      label: "",
      tipo: "select",
      opcoes: [],
      categorias_aplicaveis: [],
      ordem: 0,
      ativo: true,
    });
    setShowDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingConfig) {
        await base44.entities.AtributoConfig.update(editingConfig.id, formData);
      } else {
        await base44.entities.AtributoConfig.create(formData);
      }
      toast({
        title: "Sucesso!",
        description: editingConfig ? "Atributo atualizado." : "Atributo criado.",
      });
      setShowDialog(false);
      loadConfigs();
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: "Erro ao salvar atributo.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (config) => {
    if (confirm(`Excluir o atributo "${config.label}"?`)) {
      try {
        await base44.entities.AtributoConfig.delete(config.id);
        loadConfigs();
        toast({ title: "Atributo excluído" });
      } catch (e) {
        toast({ title: "Erro", description: "Erro ao excluir.", variant: "destructive" });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-7 h-7" /> Atributos do Catálogo
            </h1>
            <p className="text-gray-600">
              Gerencie os atributos e opções disponíveis por categoria
            </p>
          </div>
          <Button
            onClick={handleNew}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Atributo
          </Button>
        </div>

        {configs.length === 0 ? (
          <Card className="bg-white shadow">
            <CardContent className="p-12 text-center">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum atributo configurado</h3>
              <p className="text-gray-500 mb-4">
                Crie atributos para gerenciar as opções do catálogo padronizado.
              </p>
              <Button onClick={handleNew} className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
                <Plus className="w-4 h-4 mr-2" /> Criar primeiro atributo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configs.map((config) => (
              <Card key={config.id} className="bg-white shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{config.label}</h3>
                      <p className="text-xs text-gray-400 font-mono">{config.campo}</p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant={config.tipo === "select" ? "default" : "secondary"}>
                        {config.tipo}
                      </Badge>
                      {config.ativo === false && (
                        <Badge variant="destructive">Inativo</Badge>
                      )}
                    </div>
                  </div>

                  {config.tipo === "select" && config.opcoes && config.opcoes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {config.opcoes.map((opt, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {opt}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {config.categorias_aplicaveis && config.categorias_aplicaveis.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {config.categorias_aplicaveis.map((cat) => (
                        <Badge key={cat} className="text-xs bg-blue-50 text-blue-700">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(config)}
                      className="flex-1"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar Atributo" : "Novo Atributo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Nome do campo (técnico) *</Label>
              <Input
                value={formData.campo}
                onChange={(e) => setFormData({ ...formData, campo: e.target.value })}
                required
                placeholder="ex: acabamento, tipo_furo"
                disabled={!!editingConfig}
              />
              <p className="text-xs text-gray-400 mt-1">
                Deve corresponder ao campo no ProductTemplate
              </p>
            </div>
            <div>
              <Label>Rótulo de exibição *</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
                placeholder="ex: Acabamento, Tipo de Furo"
              />
            </div>
            <div>
              <Label>Tipo do campo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">Select (lista de opções)</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="boolean">Sim/Não</SelectItem>
                  <SelectItem value="text">Texto livre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tipo === "select" && (
              <div>
                <Label>Opções</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newOpcao}
                    onChange={(e) => setNewOpcao(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOpcao();
                      }
                    }}
                    placeholder="Digite uma opção e pressione Enter"
                  />
                  <Button type="button" onClick={handleAddOpcao} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {formData.opcoes.map((opt, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5"
                    >
                      <span className="text-sm">{opt}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOpcao(i)}
                        className="h-6 w-6 p-0 text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {formData.opcoes.length === 0 && (
                    <p className="text-xs text-gray-400">Nenhuma opção adicionada</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Categorias onde se aplica</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      formData.categorias_aplicaveis.includes(cat)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ativo_attr"
                checked={formData.ativo}
                onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
              />
              <Label htmlFor="ativo_attr">Ativo</Label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-green-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingConfig ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}