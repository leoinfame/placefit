import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Youtube, GripVertical, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const TIPOS = [
  { value: "revendedor", label: "Revendedor", color: "bg-blue-100 text-blue-800" },
  { value: "fabricante", label: "Fabricante", color: "bg-green-100 text-green-800" },
  { value: "transportador", label: "Transportador", color: "bg-orange-100 text-orange-800" },
];

const EMPTY_FORM = {
  tipo_usuario: "revendedor",
  ordem: 1,
  titulo: "",
  descricao: "",
  icone: "📋",
  menu_item: "",
  video_url: "",
  ativo: true,
};

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s?]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function Treinamento() {
  const [user, setUser] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("revendedor");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await base44.auth.me();
    if (currentUser.role !== "admin") {
      window.location.href = "/";
      return;
    }
    setUser(currentUser);
    const data = await base44.entities.TreinamentoStep.list("ordem");
    setSteps(data);
    setLoading(false);
  };

  const openCreate = (tipo) => {
    const stepsForTipo = steps.filter(s => s.tipo_usuario === tipo);
    setForm({ ...EMPTY_FORM, tipo_usuario: tipo, ordem: stepsForTipo.length + 1 });
    setEditingStep(null);
    setDialogOpen(true);
  };

  const openEdit = (step) => {
    setForm({ ...step });
    setEditingStep(step);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo || !form.descricao) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editingStep) {
      await base44.entities.TreinamentoStep.update(editingStep.id, form);
    } else {
      await base44.entities.TreinamentoStep.create(form);
    }
    await loadData();
    setDialogOpen(false);
    setSaving(false);
    toast({ title: editingStep ? "Passo atualizado!" : "Passo criado!" });
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este passo?")) return;
    await base44.entities.TreinamentoStep.delete(id);
    setSteps(steps.filter(s => s.id !== id));
    toast({ title: "Passo removido" });
  };

  const toggleAtivo = async (step) => {
    await base44.entities.TreinamentoStep.update(step.id, { ativo: !step.ativo });
    setSteps(steps.map(s => s.id === step.id ? { ...s, ativo: !s.ativo } : s));
  };

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Treinamento
          </h1>
          <p className="text-gray-500 mt-1">Configure o tour de boas-vindas para cada tipo de usuário</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            {TIPOS.map(t => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TIPOS.map(tipo => {
            const tipoSteps = steps
              .filter(s => s.tipo_usuario === tipo.value)
              .sort((a, b) => a.ordem - b.ordem);

            return (
              <TabsContent key={tipo.value} value={tipo.value} className="space-y-3 mt-4">
                <div className="flex justify-end">
                  <Button
                    onClick={() => openCreate(tipo.value)}
                    className="bg-gradient-to-r from-blue-600 to-green-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Passo
                  </Button>
                </div>

                {tipoSteps.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center text-gray-400">
                      Nenhum passo cadastrado. Clique em "Novo Passo" para começar.
                    </CardContent>
                  </Card>
                )}

                {tipoSteps.map((step, idx) => (
                  <Card key={step.id} className={`border ${!step.ativo ? "opacity-50" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center text-sm font-bold text-blue-700">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xl">{step.icone || "📋"}</span>
                            <h3 className="font-semibold text-gray-900">{step.titulo}</h3>
                            {!step.ativo && <Badge variant="secondary">Inativo</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{step.descricao}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {step.menu_item && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                📌 {step.menu_item}
                              </span>
                            )}
                            {step.video_url && (
                              <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded flex items-center gap-1">
                                <Youtube className="w-3 h-3" /> Vídeo vinculado
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => toggleAtivo(step)} title={step.ativo ? "Desativar" : "Ativar"}>
                            <span className="text-sm">{step.ativo ? "✓" : "○"}</span>
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(step)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(step.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Editar Passo" : "Novo Passo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo de Usuário</Label>
                <Select value={form.tipo_usuario} onValueChange={v => setForm(f => ({ ...f, tipo_usuario: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.ordem}
                  onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Ícone (emoji)</Label>
                <Input
                  value={form.icone}
                  onChange={e => setForm(f => ({ ...f, icone: e.target.value }))}
                  placeholder="🎉"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Item de Menu</Label>
                <Input
                  value={form.menu_item}
                  onChange={e => setForm(f => ({ ...f, menu_item: e.target.value }))}
                  placeholder="Ex: Meus Produtos"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título do passo"
              />
            </div>

            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Textarea
                rows={4}
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Explique o que o usuário aprenderá neste passo..."
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                URL do Vídeo (YouTube)
              </Label>
              <Input
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {form.video_url && getYouTubeEmbedUrl(form.video_url) && (
                <div className="mt-2 rounded-lg overflow-hidden aspect-video">
                  <iframe
                    src={getYouTubeEmbedUrl(form.video_url)}
                    className="w-full h-full"
                    allowFullScreen
                    title="Preview"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-green-600 text-white"
            >
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}