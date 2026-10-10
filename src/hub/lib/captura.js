import { base44 } from "@/api/base44Client";

// Foto do volume: reduz para no maximo 1600px (JPEG) antes de subir — celular manda 4-12 MB.
export async function comprimirFoto(file, lado = 1600, qualidade = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", qualidade));
    return new File([blob], `volume-${Date.now()}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // formato que o navegador nao decodifica: sobe o original
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function enviarFoto(file) {
  const leve = await comprimirFoto(file);
  const { file_url } = await base44.integrations.Core.UploadFile({ file: leve });
  return file_url;
}

// Localizacao de um momento (sem GPS continuo). Nunca trava a operacao: sem permissao segue com geo_status.
export function pegarLocalizacao(timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ geo_status: "indisponivel" });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precisao_m: Math.round(pos.coords.accuracy),
        geo_status: "ok",
      }),
      (err) => resolve({ geo_status: err.code === 1 ? "negado" : "indisponivel" }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}
