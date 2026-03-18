import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit3, Trash2, Users, Package, CheckCircle, X, Save, Loader2, Crown, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function AdminServicos() {
  const [user, setUser] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("planos");

  // Dialog plano
  const [showPlanoDialog, setShowPlanoDialog] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [planoForm, setPlanoForm] = useState({ nome: "", slug: "", descricao: "", preco_mensal: "", icone: "🤖", cor: "blue", ativo: true, destaque: false, beneficios: [] });
  const [novoBeneficio, setNovoBeneficio] = useState("");

  // Dialog assinatura
  const [showAssDialog, setShowAssDialog] = useState(false);
  const [assForm, setAssForm] = useState({ usuario_id: "", plano_id: "", status: "ativo", data_inicio: "", data_vencimento: "", observacoes: "" });
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') { window.location.href = '/Dashboard'; return; }
      setUser(currentUser);

      const [planosData, assData, usersData] = await Promise.all([
        base44.entities.PlanoServico.list(),
        base44.entities.AssinaturaUsuario.list('-created_date'),
        base44.entities.User.list()
      ]);

      setPlanos(planosData);
      setAssinaturas(assData);
      setUsuarios(usersData.filter(u => u.role === 'user'));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSavePlano = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = { ...planoForm, preco_mensal: parseFloat(planoForm.preco_mensal) };
      if (editingPlano) {
        await base44.entities.PlanoServico.update(editingPlano.id, data);
        toast({ title: "Plano atualizado!" });
      } else {
        await base44.entities.PlanoServico.create(data);
        toast({ title: "Plano criado!" });
      }
      setShowPlanoDialog(false);
      resetPlanoForm();
      loadData();
    } catch (e) {
      toast({ title: "Erro ao salvar plano", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleSaveAssinatura = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const usuario = usuarios.find(u => u.id === assForm.usuario_id);
      const plano = planos.find(p => p.id === assForm.plano_id);
      await base44.entities.AssinaturaUsuario.create({
        ...assForm,
        usuario_email: usuario?.email || "",
        usuario_nome: usuario?.empresa || usuario?.full_name || "",
        plano_slug: plano?.slug || "",
        plano_nome: plano?.nome || ""
      });
      toast({ title: "Assinatura criada!", description: `Acesso liberado para ${usuario?.empresa || usuario?.full_name}` });
      setShowAssDialog(false);
      setAssForm({ usuario_id: "", plano_id: "", status: "ativo", data_inicio: "", data_vencimento: "", observacoes: "" });
      loadData();
    } catch (e) {
      toast({ title: "Erro ao criar assinatura", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleToggleAssinatura = async (ass) => {
    const novoStatus = ass.status === 'ativo' ? 'suspenso' : 'ativo';
    await base44.entities.AssinaturaUsuario.update(ass.id, { status: novoStatus });
    toast({ title: novoStatus === 'ativo' ? "Assinatura reativada!" : "Assinatura suspensa" });
    loadData();
  };

  const handleDeleteAssinatura = async (ass) => {
    if (confirm(`Remover acesso de ${ass.usuario_nome} ao plano ${ass.plano_nome}?`)) {
      await base44.entities.AssinaturaUsuario.delete(ass.id);
      toast({ title: "Assinatura removida" });
      loadData();
    }
  };

  const resetPlanoForm = () => {
    setPlanoForm({ nome: "", slug: "", descricao: "", preco_mensal: "", icone: "🤖", cor: "blue", ativo: true, destaque: false, beneficios: [] });
    setEditingPlano(null);
    setNovoBeneficio("");
  };

  const openEditPlano = (plano) => {
    setEditingPlano(plano);
    setPlanoForm({ ...plano, beneficios: plano.beneficios || [] });
    setShowPlanoDialog(true);
  };

  const addBeneficio = () => {
    if (novoBeneficio.trim()) {
      setPlanoForm(f => ({ ...f, beneficios: [...(f.beneficios || []), novoBeneficio.trim()] }));
      setNovoBeneficio("");
    }
  };

  const removeBeneficio = (idx) => {
    setPlanoForm(f => ({ ...f, beneficios: f.beneficios.filter((_, i) => i !== idx) }));
  };

  const statusColor = { ativo: "bg-green-100 text-green-700", suspenso: "bg-yellow-100 text-yellow-700", cancelado: "bg-red-100 text-red-700", trial: "bg-blue-100 text-blue-700" };

  if (loading) return <div className="p-8 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div><div className="h-64 bg-gray-200 rounded"></div></div>;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-500" />
            Gestão de Serviços
          </h1>
          <p className="text-gray-600">Gerencie planos, preços e acessos dos usuários</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{planos.length}</div>
              <p className="text-sm text-purple-700">Planos Criados</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{assinaturas.filter(a => a.status === 'ativo').length}</div>
              <p className="text-sm text-green-700">Assinaturas Ativas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{new Set(assinaturas.filter(a => a.status === 'ativo').map(a => a.usuario_id)).size}</div>
              <p className="text-sm text-blue-700">Usuários Pagantes</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-white/80">
            <TabsTrigger value="planos"><Package className="w-4 h-4 mr-2" />Planos</TabsTrigger>
            <TabsTrigger value="assinaturas"><Users className="w-4 h-4 mr-2" />Assinaturas</TabsTrigger>
          </TabsList>

          {/* TAB PLANOS */}
          <TabsContent value="planos" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { resetPlanoForm(); setShowPlanoDialog(true); }} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                <Plus className="w-4 h-4 mr-2" />Novo Plano
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planos.map(plano => (
                <Card key={plano.id} className={`border-2 ${plano.destaque ? 'border-yellow-400' : 'border-gray-200'}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{plano.icone}</span>
                        <div>
                          <h3 className="font-bold text-gray-900">{plano.nome}</h3>
                          <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">{plano.slug}</code>
                        </div>
                      </div>
                      {plano.destaque && <Badge className="bg-yellow-100 text-yellow-700 text-xs">⭐ Destaque</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{plano.descricao}</p>
                    <div className="text-2xl font-bold text-gray-900 mb-3">
                      R$ {parseFloat(plano.preco_mensal || 0).toFixed(2)}<span className="text-sm font-normal text-gray-500">/mês</span>
                    </div>
                    {plano.beneficios?.length > 0 && (
                      <ul className="space-y-1 mb-4">
                        {plano.beneficios.map((b, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />{b}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <Badge className={plano.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                        {plano.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditPlano(plano)} className="hover:bg-blue-50 hover:text-blue-700">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => { if(confirm('Excluir plano?')) { await base44.entities.PlanoServico.delete(plano.id); loadData(); } }} className="hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {planos.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum plano criado ainda</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB ASSINATURAS */}
          <TabsContent value="assinaturas" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowAssDialog(true)} className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                <Plus className="w-4 h-4 mr-2" />Liberar Acesso
              </Button>
            </div>
            <Card className="bg-white/80 border-0 shadow-lg">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-500 to-blue-500">
                        <th className="text-left p-3 text-white font-semibold">Usuário</th>
                        <th className="text-left p-3 text-white font-semibold">Plano</th>
                        <th className="text-left p-3 text-white font-semibold">Status</th>
                        <th className="text-left p-3 text-white font-semibold">Vencimento</th>
                        <th className="text-center p-3 text-white font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assinaturas.map((ass, idx) => (
                        <tr key={ass.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors border-t`}>
                          <td className="p-3">
                            <div className="font-medium text-gray-900">{ass.usuario_nome}</div>
                            <div className="text-xs text-gray-500">{ass.usuario_email}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{ass.plano_nome}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge className={statusColor[ass.status] || "bg-gray-100 text-gray-700"}>{ass.status}</Badge>
                          </td>
                          <td className="p-3 text-gray-600">
                            {ass.data_vencimento ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleToggleAssinatura(ass)} className={ass.status === 'ativo' ? "hover:bg-yellow-50 hover:text-yellow-700" : "hover:bg-green-50 hover:text-green-700"} title={ass.status === 'ativo' ? 'Suspender' : 'Reativar'}>
                                {ass.status === 'ativo' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteAssinatura(ass)} className="hover:bg-red-50 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {assinaturas.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Nenhuma assinatura registrada</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Plano */}
        <Dialog open={showPlanoDialog} onOpenChange={(open) => { setShowPlanoDialog(open); if (!open) resetPlanoForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlano ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSavePlano} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={planoForm.nome} onChange={e => setPlanoForm(f => ({ ...f, nome: e.target.value }))} required placeholder="Ex: Atendente IA" />
                </div>
                <div>
                  <Label>Slug * <span className="text-xs text-gray-400">(sem espaços)</span></Label>
                  <Input value={planoForm.slug} onChange={e => setPlanoForm(f => ({ ...f, slug: e.target.value.replace(/\s/g, '_') }))} required placeholder="Ex: atendente_ia" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={planoForm.descricao} onChange={e => setPlanoForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Preço Mensal (R$) *</Label>
                  <Input type="number" step="0.01" value={planoForm.preco_mensal} onChange={e => setPlanoForm(f => ({ ...f, preco_mensal: e.target.value }))} required />
                </div>
                <div>
                  <Label>Ícone (emoji)</Label>
                  <Input value={planoForm.icone} onChange={e => setPlanoForm(f => ({ ...f, icone: e.target.value }))} />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Select value={planoForm.cor} onValueChange={v => setPlanoForm(f => ({ ...f, cor: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["blue","purple","green","orange","pink","indigo"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Benefícios</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={novoBeneficio} onChange={e => setNovoBeneficio(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBeneficio())} placeholder="Adicionar benefício..." />
                  <Button type="button" variant="outline" onClick={addBeneficio}><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="mt-2 space-y-1">
                  {(planoForm.beneficios || []).map((b, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded text-sm">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="flex-1">{b}</span>
                      <button type="button" onClick={() => removeBeneficio(i)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={planoForm.ativo} onCheckedChange={v => setPlanoForm(f => ({ ...f, ativo: v }))} />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={planoForm.destaque} onCheckedChange={v => setPlanoForm(f => ({ ...f, destaque: v }))} />
                  <Label>Destaque</Label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowPlanoDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-purple-600 to-blue-600">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Assinatura */}
        <Dialog open={showAssDialog} onOpenChange={setShowAssDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Liberar Acesso a Serviço</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAssinatura} className="space-y-4">
              <div>
                <Label>Usuário *</Label>
                <Select value={assForm.usuario_id} onValueChange={v => setAssForm(f => ({ ...f, usuario_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                  <SelectContent>
                    {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.empresa || u.full_name} ({u.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano *</Label>
                <Select value={assForm.plano_id} onValueChange={v => setAssForm(f => ({ ...f, plano_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                  <SelectContent>
                    {planos.filter(p => p.ativo).map(p => <SelectItem key={p.id} value={p.id}>{p.icone} {p.nome} — R$ {parseFloat(p.preco_mensal).toFixed(2)}/mês</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={assForm.status} onValueChange={v => setAssForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Início</Label>
                  <Input type="date" value={assForm.data_inicio} onChange={e => setAssForm(f => ({ ...f, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label>Data Vencimento</Label>
                  <Input type="date" value={assForm.data_vencimento} onChange={e => setAssForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={assForm.observacoes} onChange={e => setAssForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAssDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting || !assForm.usuario_id || !assForm.plano_id} className="bg-gradient-to-r from-green-600 to-blue-600">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Liberar Acesso
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}