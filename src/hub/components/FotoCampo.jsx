import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw } from "lucide-react";

// Abre a camera do celular direto (capture). Guarda o File; o envio acontece no confirmar.
export default function FotoCampo({ arquivo, onArquivo, rotulo = "Tirar foto do volume" }) {
  const input = useRef(null);
  const preview = arquivo ? URL.createObjectURL(arquivo) : null;
  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onArquivo(e.target.files[0])}
      />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Foto do volume" className="max-h-72 w-full rounded-xl object-cover" />
          <Button size="sm" variant="secondary" className="absolute bottom-2 right-2" onClick={() => input.current.click()}>
            <RefreshCw className="mr-1 h-4 w-4" />Refazer
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="h-24 w-full border-2 border-dashed text-base" onClick={() => input.current.click()}>
          <Camera className="mr-2 h-6 w-6" />{rotulo}
        </Button>
      )}
    </div>
  );
}
