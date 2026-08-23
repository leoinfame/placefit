import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle } from "lucide-react";

export default function SignupDialog({ open, onClose }) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    empresa: "",
    whatsapp: "",
    cupom: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.email) return;
    setLoading(true);
    setError("");
    try {
      await base44.functions.invoke("inscreverApp", form);
      setDone(true);
    } catch (err) {
      setError(err.message || "Erro ao registrar inscrição");
    }
    setLoading(false);
  };

  const handleLoginRedirect = () => {
    onClose();
    base44.auth.redirectToLogin("/MinhaConta");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Inscrição registrada!</h2>
            <p className="text-slate-500 mt-2 text-sm">
              Clique no botão abaixo para criar sua conta Google e acessar o PlaceFit.
              Você terá <strong className="text-green-600">30 dias grátis</strong>.
            </p>
            <Button
              onClick={handleLoginRedirect}
              className="mt-6 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white w-full"
            >
              Criar conta e acessar
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="text-xl">Assinar o PlaceFit</DialogTitle>
              <DialogDescription>
                Preencha seus dados para começar. 30 dias grátis, sem cartão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>Cupom (aluno do curso)</Label>
                <Input
                  value={form.cupom}
                  onChange={(e) => setForm({ ...form, cupom: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Continuar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}