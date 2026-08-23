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
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-md">
        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Inscrição registrada!</h2>
            <p className="text-gray-400 mt-2 text-sm">
              Clique no botão abaixo para criar sua conta Google e acessar o PlaceFit.
              Você terá <strong className="text-green-500">30 dias grátis</strong>.
            </p>
            <Button
              onClick={handleLoginRedirect}
              className="mt-6 bg-green-600 hover:bg-green-700 text-white w-full"
            >
              Criar conta e acessar
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="text-white text-xl">Assinar o PlaceFit</DialogTitle>
              <DialogDescription className="text-gray-400">
                Preencha seus dados para começar. 30 dias grátis, sem cartão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div>
                <Label className="text-gray-300">Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Empresa</Label>
                <Input
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Cupom (aluno do curso)</Label>
                <Input
                  value={form.cupom}
                  onChange={(e) => setForm({ ...form, cupom: e.target.value })}
                  placeholder="Opcional"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white w-full"
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