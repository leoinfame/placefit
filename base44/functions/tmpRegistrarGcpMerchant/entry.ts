// TEMPORÁRIA (12/10/2026) — APAGAR logo após o uso.
// Faz UMA vez o registro do projeto GCP da conta de serviço na conta Merchant da
// PlaceFit (developerRegistration:registerGcp), exigido pela Merchant API.
// Protegida por chave aleatória (segredo TMP_REGISTRO_KEY). Não devolve segredo nenhum.

function b64url(s: string | Uint8Array) {
  const str = typeof s === "string" ? btoa(s) : btoa(String.fromCharCode(...s));
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function tokenGoogle(cred: any) {
  const now = Math.floor(Date.now() / 1000);
  const entrada = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: cred.client_email, scope: "https://www.googleapis.com/auth/content",
    aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now,
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(cred.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(entrada)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${entrada}.${b64url(sig)}` }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`token Google ${res.status}: ${data.error_description || data.error || "falhou"}`);
  return data.access_token as string;
}

export default async function (req: Request) {
  const chave = String(Deno.env.get("TMP_REGISTRO_KEY") || "");
  if (!chave || req.headers.get("x-tmp-key") !== chave) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const merchantId = String(Deno.env.get("GOOGLE_MERCHANT_ID") || "");
    const cred = JSON.parse(String(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "{}"));
    const token = await tokenGoogle(cred);
    const res = await fetch(`https://merchantapi.googleapis.com/accounts/v1/accounts/${merchantId}/developerRegistration:registerGcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ developerEmail: cred.client_email }),
    });
    const corpo = await res.text();
    return Response.json({ http: res.status, resposta: corpo.slice(0, 1500), merchant: merchantId, conta: cred.client_email });
  } catch (e) {
    return Response.json({ erro: String((e as any)?.message || e).slice(0, 500) }, { status: 500 });
  }
}
