import React, { useState } from "react";
import { UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function VincularUsuarioDialog({ fabricante, unlinkedUsers, onVincular, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = unlinkedUsers.filter(u =>
    (u.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.empresa?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Vincular Usuário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Fabricante:</p>
            <p className="font-semibold text-gray-900">{fabricante?.nome_fantasia || fabricante?.razao_social}</p>
          </div>

          {unlinkedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Não há usuários fabricante disponíveis para vincular.</p>
              <p className="text-xs mt-1">Todos os usuários fabricante já estão vinculados a um cadastro, ou não existe nenhum cadastrado via link de registro.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar usuário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {filtered.map(u => (
                  <div
                    key={u.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${selected?.id === u.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => setSelected(u)}
                  >
                    <p className="font-medium text-sm">{u.full_name || u.email}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                    {u.empresa && <Badge variant="outline" className="text-xs mt-1">{u.empresa}</Badge>}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">Nenhum usuário encontrado.</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button
                  onClick={() => selected && onVincular(selected)}
                  disabled={!selected}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Vincular
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}