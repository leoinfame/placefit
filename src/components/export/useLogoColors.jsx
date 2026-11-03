import { useState, useEffect } from "react";

/**
 * Extrai as 2 cores predominantes de uma imagem via Canvas API.
 * Retorna { primary, secondary, text, light } em formato hex.
 */
export function useLogoColors(logoUrl) {
  const [colors, setColors] = useState(null);

  useEffect(() => {
    if (!logoUrl) {
      setColors(getDefaultColors());
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size).data;
        const colorMap = {};

        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          // Ignorar pixels transparentes e muito claros/escuros (brancos/pretos)
          if (a < 128) continue;
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue;

          // Quantizar para reduzir variações
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;
          colorMap[key] = (colorMap[key] || 0) + 1;
        }

        const sorted = Object.entries(colorMap)
          .sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
          setColors(getDefaultColors());
          return;
        }

        const [r1, g1, b1] = sorted[0][0].split(",").map(Number);
        // Pegar segunda cor que seja suficientemente diferente da primeira
        let secondary = null;
        for (let i = 1; i < sorted.length; i++) {
          const [r2, g2, b2] = sorted[i][0].split(",").map(Number);
          const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          if (diff > 80) {
            secondary = { r: r2, g: g2, b: b2 };
            break;
          }
        }

        if (!secondary) secondary = darken({ r: r1, g: g1, b: b1 }, 0.3);

        const primary = { r: r1, g: g1, b: b1 };
        setColors(buildColorSet(primary, secondary));
      } catch {
        setColors(getDefaultColors());
      }
    };
    img.onerror = () => setColors(getDefaultColors());
    img.src = logoUrl;
  }, [logoUrl]);

  return colors;
}

function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function darken({ r, g, b }, amount) {
  return {
    r: Math.max(0, Math.round(r * (1 - amount))),
    g: Math.max(0, Math.round(g * (1 - amount))),
    b: Math.max(0, Math.round(b * (1 - amount))),
  };
}

function lighten({ r, g, b }, amount) {
  return {
    r: Math.min(255, Math.round(r + (255 - r) * amount)),
    g: Math.min(255, Math.round(g + (255 - g) * amount)),
    b: Math.min(255, Math.round(b + (255 - b) * amount)),
  };
}

function luminance({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function buildColorSet(primary, secondary) {
  const lum = luminance(primary);
  const textOnPrimary = lum > 140 ? "#1e293b" : "#ffffff";

  return {
    primary: rgbToHex(primary),
    primaryDark: rgbToHex(darken(primary, 0.25)),
    secondary: rgbToHex(secondary),
    secondaryDark: rgbToHex(darken(secondary, 0.25)),
    light: rgbToHex(lighten(primary, 0.88)),
    lightBorder: rgbToHex(lighten(primary, 0.70)),
    textOnPrimary,
    textAccent: rgbToHex(darken(primary, 0.15)),
  };
}

function getDefaultColors() {
  return {
    primary: "#1e3a5f",
    primaryDark: "#0f172a",
    secondary: "#1e40af",
    secondaryDark: "#1e3a8a",
    light: "#eff6ff",
    lightBorder: "#bfdbfe",
    textOnPrimary: "#ffffff",
    textAccent: "#1e40af",
  };
}