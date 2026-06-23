import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PrecoModal({
  open,
  product,
  existingPrice,
  onSave,
  onClose,
}) {
  const [preco, setPreco] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPreco(existingPrice ? String(existingPrice.preco) : "");
      setObservacoes(existingPrice?.observacoes || "");
    }
  }, [open, existingPrice]);

  const handleSave = async () => {
    const precoNum = parseFloat(preco);
    if (!precoNum || precoNum <= 0) {
      alert("Informe um preço válido.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ preco: precoNum, observacoes });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existingPrice ? "Editar Preço" : "Adicionar Preço"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Produto</Label>
            <p className="text-sm text-gray-600 mt-1">
              {product?.nome}{" "}
              <span className="text-gray-400">({product?.cod})</span>
            </p>
          </div>
          <div>
            <Label htmlFor="preco">Preço (R$)</Label>
            <Input
              id="preco"
              type="number"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações opcionais"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !preco}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}