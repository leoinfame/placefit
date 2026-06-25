import React, { useState, useEffect } from "react";
import { UploadFile } from "@/integrations/Core";
import { adminUpdateUser } from "@/functions/adminUpdateUser";
import { UserCog, Upload, Loader2, Check, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
];

const EMPTY = {
  full_name: "", empresa: "", cnpj: "", endereco: "",
  whatsapp: "", site: "", logomarca: "",
  condicoes_pagamento: "", prazo_producao: "",
  informacoes_frete: "", historia_empresa: "",
  formas_pagamento: "", prazo_entrega: "", politica_troca: "",
  cidade: "", estado: "",
};

export default function EditProfileDialog({ open, onOpenChange, usuario, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (usuario) {
      setForm({
        full_name: usuario.full_name || "",
        empresa: usuario.empresa || "",
        cnpj: usuario.cnpj || "",
        endereco: usuario.endereco || "",
        whatsapp: usuario.whatsapp || "",
        site: usuario.site || "",
        logomarca: usuario.logomarca || "",
        condicoes_pagamento: usuario.condicoes_pagamento || "",
        prazo_producao: usuario.prazo_producao || "",
        informacoes_frete: usuario.informacoes_frete || "",
        historia_empresa: usuario.historia_empresa || "",
        formas_pagamento: usuario.formas_pagamento || "",
        prazo_entrega: usuario.prazo_entrega || "",
        politica_troca: usuario.politica_troca || "",
        cidade: usuario.cidade || "",
        estado: usuario.estado || "",
      });
    }
  }, [usuario]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await UploadFile({ file });
      set("logomarca", file_url);
    } catch {
      toast({ title: "Erro", description: "Falha no upload da logo.", variant: "destructive" });
    }
    setUploadingLogo(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { full_name, ...rest } = form;
      const data = { ...rest };
      // full_name é built-in — enviar junto (adminUpdateUser usa asServiceRole)
      if (full_name) data.full_name = full_name;
      await adminUpdateUser({ userId: usuario.id, data });
      toast({ title: "Perfil atualizado!", description: "Todos os dados foram salvos." });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: "Erro", description: error?.message || "Erro ao salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            Editar Perfil — {usuario?.full_name || usuario?.email}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5 pt-2">
            {/* Logomarca */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
              <div className="w-24 h-24 rounded-lg bg-white border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.logomarca ? (
                  <img src={form.logomarca} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="admin-logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('admin-logo-upload')?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" />Enviar Logo</>
                  )}
                </Button>
                <Input
                  value={form.logomarca}
                  onChange={(e) => set("logomarca", e.target.value)}
                  placeholder="URL da logo"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Dados Principais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome do Responsável</Label>
                <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Nome da Empresa</Label>
                <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" className="mt-1" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-9999" className="mt-1" />
              </div>
              <div>
                <Label>Site</Label>
                <Input value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="suaempresa.com.br" className="mt-1" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Endereço Completo</Label>
                <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro, CEP..." className="mt-1" />
              </div>
            </div>

            {/* Campos de Tabela / Comercial */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 border-b pb-1">Informações Comerciais</h4>
              <div>
                <Label>Condições de Pagamento</Label>
                <Textarea value={form.condicoes_pagamento} onChange={(e) => set("condicoes_pagamento", e.target.value)} rows={2} className="mt-1" />
              </div>
              <div>
                <Label>Formas de Pagamento</Label>
                <Textarea value={form.formas_pagamento} onChange={(e) => set("formas_pagamento", e.target.value)} rows={2} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prazo de Produção</Label>
                  <Textarea value={form.prazo_producao} onChange={(e) => set("prazo_producao", e.target.value)} rows={2} className="mt-1" />
                </div>
                <div>
                  <Label>Prazo de Entrega</Label>
                  <Textarea value={form.prazo_entrega} onChange={(e) => set("prazo_entrega", e.target.value)} rows={2} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Informações de Frete</Label>
                <Textarea value={form.informacoes_frete} onChange={(e) => set("informacoes_frete", e.target.value)} rows={2} className="mt-1" />
              </div>
              <div>
                <Label>Política de Troca</Label>
                <Textarea value={form.politica_troca} onChange={(e) => set("politica_troca", e.target.value)} rows={2} className="mt-1" />
              </div>
              <div>
                <Label>História da Empresa</Label>
                <Textarea value={form.historia_empresa} onChange={(e) => set("historia_empresa", e.target.value)} rows={3} className="mt-1" />
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Check className="w-4 h-4 mr-2" />Salvar Tudo</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}