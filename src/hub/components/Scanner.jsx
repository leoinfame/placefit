import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keyboard, CameraOff } from "lucide-react";
import { criarLeitor } from "../lib/qr";

// Camera traseira lendo QR. Sem camera (ou etiqueta rasgada), da para digitar o codigo.
export default function Scanner({ onLer }) {
  const video = useRef(null);
  const [erroCamera, setErroCamera] = useState("");
  const [digitar, setDigitar] = useState(false);
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    if (digitar) return;
    let stream = null;
    let parar = false;
    const ler = criarLeitor();
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (parar) return;
        video.current.srcObject = stream;
        await video.current.play();
        const loop = async () => {
          if (parar) return;
          const texto = await ler(video.current).catch(() => null);
          if (texto) {
            if (navigator.vibrate) navigator.vibrate(80);
            onLer(texto, false);
            return;
          }
          setTimeout(loop, 180);
        };
        loop();
      } catch (e) {
        setErroCamera(e?.name === "NotAllowedError" ? "Permita o uso da câmera para escanear." : "Câmera indisponível neste aparelho.");
        setDigitar(true);
      }
    })();
    return () => {
      parar = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [digitar, onLer]);

  return (
    <div className="space-y-3">
      {!digitar ? (
        <div className="relative overflow-hidden rounded-xl bg-black aspect-square">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-4 border-white/80" />
        </div>
      ) : (
        <div className="space-y-2">
          {erroCamera && (
            <p className="flex items-center gap-2 text-sm text-amber-700"><CameraOff className="h-4 w-4" />{erroCamera}</p>
          )}
          <Input
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Código da etiqueta (ex.: K7QX2M9PAB)"
            className="h-12 text-lg tracking-widest"
          />
          <Button className="h-12 w-full" disabled={codigo.trim().length < 6} onClick={() => onLer(codigo, true)}>
            Usar este código
          </Button>
        </div>
      )}
      <Button variant="ghost" className="w-full" onClick={() => { setDigitar(!digitar); setErroCamera(""); }}>
        <Keyboard className="mr-2 h-4 w-4" />{digitar ? "Voltar para a câmera" : "Digitar o código"}
      </Button>
    </div>
  );
}
