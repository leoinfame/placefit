import QRCode from "qrcode";
import jsQR from "jsqr";

export function qrDataUrl(texto, tamanho = 320) {
  return QRCode.toDataURL(texto, { width: tamanho, margin: 1, errorCorrectionLevel: "M" });
}

// Leitor: usa o BarcodeDetector nativo (Android/Chrome) e cai para o jsQR (iPhone/Safari).
export function criarLeitor() {
  let detector = null;
  if ("BarcodeDetector" in window) {
    try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch { detector = null; }
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!video.videoWidth) return null;
    if (detector) {
      try {
        const r = await detector.detect(video);
        if (r?.[0]?.rawValue) return r[0].rawValue;
        return null;
      } catch { detector = null; }
    }
    const escala = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(dados.data, dados.width, dados.height, { inversionAttempts: "dontInvert" })?.data || null;
  };
}
