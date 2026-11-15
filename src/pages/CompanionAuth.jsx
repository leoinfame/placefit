import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function CompanionAuth() {
  const params = new URLSearchParams(window.location.search);
  const extensionId = params.get("extensionId") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validExtensionId = /^[a-p]{32}$/.test(extensionId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validExtensionId) {
      setError("Abra esta tela pelo botão Conectar do PlaceFit Companion.");
      return;
    }
    setBusy(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email.trim(), password);
      if (!result?.access_token || !result?.user?.id) throw new Error("O login não retornou uma sessão válida.");
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(extensionId, {
          type: "PLACEFIT_AUTH_COMPLETE",
          token: result.access_token,
          user: { id: result.user.id, email: result.user.email, full_name: result.user.full_name || "" }
        }, (reply) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) reject(new Error("Não foi possível comunicar com a extensão. Confira se ela está instalada e ativa."));
          else resolve(reply);
        });
      });
      if (!response?.ok) throw new Error(response?.error || "A extensão não confirmou a autenticação.");
      setSuccess(true);
      setPassword("");
    } catch (err) {
      setError(err?.message || "Falha ao autenticar. Confira os dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#101114",color:"#f4f4f5",fontFamily:"Inter,Arial,sans-serif",padding:24}}>
      <section style={{width:"100%",maxWidth:420,background:"#1a1b1f",border:"1px solid #34363d",borderRadius:18,padding:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:26}}>
          <div style={{width:42,height:42,borderRadius:11,background:"#16a34a",display:"grid",placeItems:"center",fontWeight:900,fontSize:24}}>P</div>
          <div><strong>PlaceFit Companion</strong><div style={{fontSize:10,letterSpacing:2,color:"#9ca3af"}}>AUTENTICAÇÃO SEGURA</div></div>
        </div>
        {success ? <>
          <h1 style={{fontSize:22}}>Acesso autorizado!</h1>
          <p style={{color:"#a1a1aa",lineHeight:1.6}}>Sua sessão foi enviada à extensão. Volte ao WhatsApp Web e mantenha esta aba aberta apenas se quiser conferir o acesso.</p>
        </> : <>
          <h1 style={{fontSize:23,margin:"0 0 8px"}}>Entre na sua conta PlaceFit</h1>
          <p style={{color:"#a1a1aa",fontSize:13,lineHeight:1.5,marginBottom:22}}>Use o mesmo e-mail e senha que você utiliza no CRM.</p>
          <form onSubmit={handleSubmit}>
            <label style={{display:"block",fontSize:12,marginBottom:6}}>E-mail</label>
            <input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} />
            <label style={{display:"block",fontSize:12,margin:"16px 0 6px"}}>Senha</label>
            <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} />
            {error && <p role="alert" style={{color:"#fca5a5",fontSize:12,lineHeight:1.5}}>{error}</p>}
            <button disabled={busy || !validExtensionId} style={{width:"100%",marginTop:20,padding:13,border:0,borderRadius:9,background:"#16a34a",color:"white",fontWeight:700,cursor:"pointer",opacity:(busy || !validExtensionId) ? 0.55 : 1}}>
              {busy ? "Conectando..." : "Conectar ao PlaceFit"}
            </button>
          </form>
          {!validExtensionId && <p style={{fontSize:11,color:"#fbbf24",marginTop:14}}>Esta tela precisa ser aberta pelo botão de conexão da extensão.</p>}
          <p style={{fontSize:10,color:"#71717a",marginTop:22}}>A senha é enviada diretamente ao serviço de autenticação Base44. A extensão recebe somente o token de sessão, mantido na memória da sessão do navegador.</p>
        </>}
      </section>
    </main>
  );
}

const inputStyle = {width:"100%",padding:12,borderRadius:8,border:"1px solid #3f4148",background:"#111214",color:"#fff",outline:"none",boxSizing:"border-box"};
