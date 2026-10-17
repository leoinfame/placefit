// Item 006 etapa 2 (16/10/2026): assistente de conexao do WhatsApp para o revendedor leigo.
// Nada tecnico na tela: sem endereco de servidor, sem chave, sem nome de sessao, sem criar conta.
// O PlaceFit cuida do servidor; cada conta tem a sua propria conexao.
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Smartphone, Wifi, AlertCircle, RefreshCw, MessageCircle, Power } from "lucide-react";

const PASSOS = ["Começar", "Abrir o WhatsApp", "Conectar aparelho", "Escanear", "Testar"];
const RENOVA_SEG = 20;

function Progresso({ passo }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PASSOS.map((p, i) => (
        <div key={p} className="flex items-center gap-1.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 < passo ? "bg-green-500 text-white" : i + 1 === passo ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}>
            {i + 1 < passo ? "✓" : i + 1}
          </div>
          {i < PASSOS.length - 1 && <div className={`w-4 h-0.5 ${i + 1 < passo ? "bg-green-500" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function Aviso({ tom = "erro", titulo, texto, acao, onAcao, ocupado }) {
  const cores = tom === "erro" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-900";
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${cores}`}>
      <p className="font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {titulo}</p>
      {texto && <p className="text-sm">{texto}</p>}
      {acao && (
        <Button size="sm" onClick={onAcao} disabled={ocupado} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {ocupado ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {acao}
        </Button>
      )}
    </div>
  );
}

export default function ConectarWhatsAppAssistente({ userId, onMudou }) {
  const [carregando, setCarregando] = useState(true);
  const [fase, setFase] = useState("");
  const [info, setInfo] = useState({});
  const [passo, setPasso] = useState(0); // 0 = tela de estado (conectado / nao liberado), 1..5 = assistente
  const [qr, setQr] = useState("");
  const [renovaEm, setRenovaEm] = useState(RENOVA_SEG);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const [testeDesde, setTesteDesde] = useState("");
  const [testeOk, setTesteOk] = useState(null);
  const pollRef = useRef(null);
  const relogioRef = useRef(null);
  const ultimoQrEm = useRef(Date.now());

  const chamar = (action, extra = {}) =>
    base44.functions.invoke("crm-whatsapp", { action, owner_id: userId, ...extra }).then((r) => r?.data || {});

  const consultar = async () => {
    try {
      const d = await chamar("assistente");
      setFase(d.fase || "fora_do_ar");
      setInfo(d);
      if (d.qr) {
        setQr((antigo) => {
          if (antigo !== d.qr) { ultimoQrEm.current = Date.now(); setRenovaEm(RENOVA_SEG); }
          return d.qr;
        });
      }
      return d;
    } catch {
      setFase("fora_do_ar");
      return { fase: "fora_do_ar" };
    }
  };

  useEffect(() => {
    (async () => {
      const d = await consultar();
      setPasso(d.fase === "conectado" || d.fase === "nao_liberado" ? 0 : 1);
      setCarregando(false);
    })();
    return () => { clearInterval(pollRef.current); clearInterval(relogioRef.current); };
  }, [userId]);

  // Prepara a conexao no servidor (cria/reinicia a sessao da conta e pede o codigo)
  const preparar = async () => {
    setPreparando(true);
    setErro("");
    try {
      const d = await chamar("connect");
      if (d.qr) { setQr(d.qr); ultimoQrEm.current = Date.now(); setRenovaEm(RENOVA_SEG); }
      if (d.session_status === "WORKING") { await consultar(); setPasso(5); setTesteDesde(new Date().toISOString()); }
      else await consultar();
    } catch {
      setErro("Não conseguimos preparar a conexão agora. Espere um minutinho e toque em Tentar de novo.");
    }
    setPreparando(false);
  };

  // Passo 4: acompanha o codigo e a leitura
  useEffect(() => {
    clearInterval(pollRef.current);
    clearInterval(relogioRef.current);
    if (passo !== 4) return;
    pollRef.current = setInterval(async () => {
      const d = await consultar();
      if (d.fase === "conectado") {
        clearInterval(pollRef.current);
        setTesteDesde(new Date().toISOString());
        setTesteOk(null);
        setPasso(5);
        onMudou?.();
      }
    }, 4000);
    relogioRef.current = setInterval(() => setRenovaEm((s) => (s > 0 ? s - 1 : RENOVA_SEG)), 1000);
    return () => { clearInterval(pollRef.current); clearInterval(relogioRef.current); };
  }, [passo]);

  // Passo 5: espera a mensagem de teste chegar
  useEffect(() => {
    if (passo !== 5 || !testeDesde) return;
    const t = setInterval(async () => {
      try {
        const d = await chamar("teste_recebido", { desde: testeDesde });
        if (d.recebida) { setTesteOk(d); clearInterval(t); }
      } catch { /* tenta de novo no proximo ciclo */ }
    }, 5000);
    return () => clearInterval(t);
  }, [passo, testeDesde]);

  const desconectar = async () => {
    setPreparando(true);
    try { await chamar("logout"); } catch { /* segue */ }
    await consultar();
    setPreparando(false);
    setPasso(1);
    onMudou?.();
  };

  // Sem conexao e fora do assistente: volta para o passo 1
  useEffect(() => {
    if (!carregando && passo === 0 && fase && fase !== "conectado" && fase !== "nao_liberado") setPasso(1);
  }, [carregando, passo, fase]);

  if (carregando) {
    return (
      <Card><CardContent className="p-6 flex items-center gap-3 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" /> Verificando seu WhatsApp…
      </CardContent></Card>
    );
  }

  // Ainda nao liberado pela equipe (servidor do PlaceFit nao configurado)
  if (fase === "nao_liberado") {
    return (
      <Card className="bg-gray-50 border-gray-200"><CardContent className="p-5 space-y-1">
        <p className="font-bold text-gray-900">Conectar seu WhatsApp</p>
        <p className="text-sm text-gray-600">
          A equipe PlaceFit está preparando esta função. Você não precisa contratar nem configurar nada:
          assim que estiver liberada, é só voltar aqui e seguir os passos.
        </p>
      </CardContent></Card>
    );
  }

  // Ja conectado
  if (passo === 0 && fase === "conectado") {
    return (
      <Card className="border-2 border-green-400 bg-green-50"><CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><Wifi className="w-6 h-6 text-green-600" /></div>
          <div>
            <p className="font-bold text-gray-900 text-lg">Seu WhatsApp está conectado</p>
            <p className="text-sm text-gray-600">
              {info.nome ? <>Número de <strong>{info.nome}</strong>{info.numero_final ? ` (final ${info.numero_final})` : ""}. </> : null}
              As conversas aparecem na aba Conversas.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={desconectar} disabled={preparando}>
            <Power className="w-4 h-4 mr-2" /> Desconectar
          </Button>
          <Button size="sm" variant="ghost" onClick={async () => { await desconectar(); }} disabled={preparando}>
            Conectar outro número
          </Button>
        </div>
      </CardContent></Card>
    );
  }

  return (
    <Card className="border-2 border-emerald-200 bg-white">
      <CardContent className="p-5 space-y-5">
        <div className="space-y-2">
          <p className="font-bold text-gray-900 text-lg">Conectar seu WhatsApp ao PlaceFit</p>
          <Progresso passo={passo} />
        </div>

        {passo === 1 && (
          <div className="space-y-3">
            <p className="text-xl font-semibold text-gray-900">Vamos conectar seu WhatsApp</p>
            <p className="text-gray-700">
              Leva uns 2 minutos. O PlaceFit entra como mais um aparelho do seu WhatsApp, igual ao WhatsApp no computador.
              Seu celular continua funcionando normalmente, e as conversas com clientes passam a aparecer organizadas aqui.
            </p>
            <p className="text-sm text-gray-500">Você não precisa criar conta nem instalar nada.</p>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setPasso(2); preparar(); }}>
              Começar
            </Button>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-3">
            <p className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Smartphone className="w-6 h-6" /> Abra o WhatsApp no celular</p>
            <p className="text-gray-700">Pegue o celular com o número que você usa para vender e abra o WhatsApp.</p>
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setPasso(3)}>Já abri</Button>
              <Button variant="ghost" onClick={() => setPasso(1)}>Voltar</Button>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-3">
            <p className="text-xl font-semibold text-gray-900">Toque em "Aparelhos conectados" e depois em "Conectar aparelho"</p>
            <ul className="text-gray-700 space-y-1 list-disc ml-5">
              <li><strong>Android:</strong> toque nos três pontinhos (⋮) no canto de cima → Aparelhos conectados → Conectar aparelho.</li>
              <li><strong>iPhone:</strong> toque em Configurações (embaixo, à direita) → Aparelhos conectados → Conectar aparelho.</li>
            </ul>
            <p className="text-sm text-gray-500">O celular vai abrir a câmera para ler um código. Deixe ele assim.</p>
            <div className="flex gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setPasso(4)}>A câmera abriu</Button>
              <Button variant="ghost" onClick={() => setPasso(2)}>Voltar</Button>
            </div>
          </div>
        )}

        {passo === 4 && (
          <div className="space-y-3">
            <p className="text-xl font-semibold text-gray-900">Aponte a câmera do celular para este código</p>
            {erro ? (
              <Aviso titulo="Não deu certo desta vez" texto={erro} acao="Tentar de novo" onAcao={preparar} ocupado={preparando} />
            ) : fase === "falhou" ? (
              <Aviso titulo="A conexão falhou" texto="Acontece de vez em quando. Toque em Tentar de novo e escaneie o código novo." acao="Tentar de novo" onAcao={preparar} ocupado={preparando} />
            ) : fase === "fora_do_ar" ? (
              <Aviso titulo="Nosso serviço de WhatsApp está fora agora" texto="Não é nada no seu celular. Tente de novo em alguns minutos." acao="Tentar de novo" onAcao={preparar} ocupado={preparando} />
            ) : fase === "desconectado" && !preparando ? (
              <Aviso tom="aviso" titulo="O código venceu" texto="O código vale só por pouco tempo. Toque no botão para gerar outro e escaneie de novo." acao="Gerar outro código" onAcao={preparar} ocupado={preparando} />
            ) : qr ? (
              <div className="flex flex-col items-center gap-2">
                <img src={qr} alt="Código para conectar o WhatsApp" className="w-64 h-64 rounded-lg border border-gray-200" />
                <p className="text-sm text-gray-500">O código se renova sozinho (próxima troca em ~{renovaEm}s). Se der erro no celular, é só ler de novo.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-600 py-10 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" /> Gerando o código…
              </div>
            )}
            <Button variant="ghost" onClick={() => setPasso(3)}>Voltar</Button>
          </div>
        )}

        {passo === 5 && (
          <div className="space-y-3">
            <p className="text-xl font-semibold text-green-700 flex items-center gap-2"><CheckCircle className="w-6 h-6" /> Pronto, seu WhatsApp está conectado!</p>
            {testeOk ? (
              <p className="text-gray-700 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                Recebemos sua mensagem de teste{testeOk.final ? ` (do número final ${testeOk.final})` : ""}. Está tudo funcionando: veja na aba Conversas.
              </p>
            ) : (
              <>
                <p className="text-gray-700">
                  Agora faça um teste: de <strong>outro celular</strong>, mande uma mensagem qualquer para o seu número.
                  Esta tela avisa quando ela chegar aqui.
                </p>
                <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Esperando a mensagem de teste…</p>
              </>
            )}
            <Button variant="outline" onClick={async () => { await consultar(); setPasso(0); onMudou?.(); }}>Concluir</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
