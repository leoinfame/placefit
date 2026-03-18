import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Clock, CheckCircle, AlertCircle, Calendar, Tag, Trash2, Edit3, Rocket, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";

export default function AdminVersions() {
  const [user, setUser] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingVersion, setEditingVersion] = useState(null);
  const [formData, setFormData] = useState({
    versao: "",
    data_lancamento: new Date().toISOString().split('T')[0],
    tipo: "feature",
    titulo: "",
    descricao: "",
    mudancas: [],
    status: "lançado",
    destaque: false
  });
  const [currentChange, setCurrentChange] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadUser();
    loadVersions();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadVersions = async () => {
    try {
      const data = await base44.entities.AppVersion.list('-data_lancamento');
      setVersions(data);
    } catch (error) {
      console.error("Erro ao carregar versões:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVersion) {
        await base44.entities.AppVersion.update(editingVersion.id, formData);
        toast({
          title: "Versão atualizada!",
          description: `Versão ${formData.versao} foi atualizada.`,
        });
      } else {
        await base44.entities.AppVersion.create(formData);
        toast({
          title: "Versão criada!",
          description: `Versão ${formData.versao} foi adicionada ao histórico.`,
        });
      }
      setShowDialog(false);
      resetForm();
      loadVersions();
    } catch (error) {
      console.error("Erro ao salvar versão:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar versão. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (version) => {
    setEditingVersion(version);
    setFormData({
      versao: version.versao,
      data_lancamento: version.data_lancamento,
      tipo: version.tipo,
      titulo: version.titulo,
      descricao: version.descricao,
      mudancas: version.mudancas || [],
      status: version.status,
      destaque: version.destaque
    });
    setShowDialog(true);
  };

  const handleDelete = async (version) => {
    if (confirm(`Tem certeza que deseja excluir a versão ${version.versao}?`)) {
      try {
        await base44.entities.AppVersion.delete(version.id);
        loadVersions();
        toast({
          title: "Versão excluída",
          description: `Versão ${version.versao} foi removida do histórico.`,
        });
      } catch (error) {
        console.error("Erro ao excluir versão:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir versão. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      versao: "",
      data_lancamento: new Date().toISOString().split('T')[0],
      tipo: "feature",
      titulo: "",
      descricao: "",
      mudancas: [],
      status: "lançado",
      destaque: false
    });
    setEditingVersion(null);
    setCurrentChange("");
  };

  const addChange = () => {
    if (currentChange.trim()) {
      setFormData({
        ...formData,
        mudancas: [...formData.mudancas, currentChange.trim()]
      });
      setCurrentChange("");
    }
  };

  const removeChange = (index) => {
    setFormData({
      ...formData,
      mudancas: formData.mudancas.filter((_, i) => i !== index)
    });
  };

  const getTipoColor = (tipo) => {
    const colors = {
      feature: "bg-blue-100 text-blue-700 border-blue-200",
      bugfix: "bg-red-100 text-red-700 border-red-200",
      improvement: "bg-green-100 text-green-700 border-green-200",
      breaking: "bg-orange-100 text-orange-700 border-orange-200",
      security: "bg-purple-100 text-purple-700 border-purple-200"
    };
    return colors[tipo] || colors.feature;
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      feature: Rocket,
      bugfix: AlertCircle,
      improvement: CheckCircle,
      breaking: AlertCircle,
      security: AlertCircle
    };
    const Icon = icons[tipo] || Rocket;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusColor = (status) => {
    const colors = {
      planejado: "bg-gray-100 text-gray-700",
      em_desenvolvimento: "bg-yellow-100 text-yellow-700",
      lançado: "bg-green-100 text-green-700"
    };
    return colors[status] || colors.lançado;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Versões e Atualizações</h1>
            <p className="text-gray-600">Histórico completo de mudanças do PlaceFit</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Versão
          </Button>
        </div>

        {/* Timeline de Versões */}
        <div className="space-y-6">
          {versions.map((version, index) => (
            <Card 
              key={version.id} 
              className={`bg-white/80 backdrop-blur-sm border-0 shadow-lg ${
                version.destaque ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-full ${getTipoColor(version.tipo)} flex items-center justify-center border-2`}>
                        {getTipoIcon(version.tipo)}
                      </div>
                      {index < versions.length - 1 && (
                        <div className="w-0.5 h-full min-h-[60px] bg-gray-200 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Badge className="text-base font-bold bg-gradient-to-r from-blue-600 to-green-600 text-white">
                          v{version.versao}
                        </Badge>
                        <Badge className={getTipoColor(version.tipo)}>
                          {version.tipo}
                        </Badge>
                        <Badge className={getStatusColor(version.status)}>
                          {version.status}
                        </Badge>
                        {version.destaque && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            ⭐ Destaque
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {version.titulo}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(version.data_lancamento).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(version)}
                      className="hover:bg-blue-50"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(version)}
                      className="hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700">{version.descricao}</p>
                {version.mudancas && version.mudancas.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Mudanças incluídas:
                    </h4>
                    <ul className="space-y-2">
                      {version.mudancas.map((change, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {versions.length === 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhuma versão cadastrada
                </h3>
                <p className="text-gray-600 mb-6">
                  Comece documentando a primeira versão do PlaceFit
                </p>
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeira Versão
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialog de Versão */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVersion ? "Editar Versão" : "Nova Versão"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="versao">Número da Versão *</Label>
                  <Input
                    id="versao"
                    value={formData.versao}
                    onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                    required
                    placeholder="Ex: 1.0.0"
                  />
                </div>
                
                <div>
                  <Label htmlFor="data_lancamento">Data de Lançamento *</Label>
                  <Input
                    id="data_lancamento"
                    type="date"
                    value={formData.data_lancamento}
                    onChange={(e) => setFormData({ ...formData, data_lancamento: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">✨ Feature (Nova funcionalidade)</SelectItem>
                      <SelectItem value="bugfix">🐛 Bugfix (Correção de bug)</SelectItem>
                      <SelectItem value="improvement">⚡ Improvement (Melhoria)</SelectItem>
                      <SelectItem value="breaking">⚠️ Breaking (Mudança quebra compatibilidade)</SelectItem>
                      <SelectItem value="security">🔒 Security (Segurança)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejado">📋 Planejado</SelectItem>
                      <SelectItem value="em_desenvolvimento">🔨 Em Desenvolvimento</SelectItem>
                      <SelectItem value="lançado">✅ Lançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                  placeholder="Ex: Integração com Google Merchant Center"
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  required
                  placeholder="Descreva as principais mudanças desta versão..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Lista de Mudanças</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={currentChange}
                      onChange={(e) => setCurrentChange(e.target.value)}
                      placeholder="Digite uma mudança e clique em adicionar"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addChange();
                        }
                      }}
                    />
                    <Button type="button" onClick={addChange} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {formData.mudancas.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {formData.mudancas.map((change, index) => (
                        <div key={index} className="flex items-start justify-between gap-2 bg-white p-2 rounded">
                          <span className="text-sm flex-1">{change}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChange(index)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.destaque}
                  onCheckedChange={(checked) => setFormData({ ...formData, destaque: checked })}
                />
                <Label>Destacar esta versão</Label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                >
                  {editingVersion ? "Salvar Alterações" : "Criar Versão"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}