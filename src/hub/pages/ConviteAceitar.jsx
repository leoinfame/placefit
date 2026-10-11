import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PackageSearch, Truck, CheckCircle2, LogIn } from "lucide-react";
import { hub } from "../lib/hubApi";
import { Cartao, Erro } from "../components/Cartao";
import { Campo } from "../components/Campos";

const PAPEL = {
  coletor: { nome: "coletor", icone: PackageSearch, faz: "buscar mercadoria nos fabricantes da sua região e levar até a base do Hub" },
  fretista: { nome: "fretista", icone: Truck, faz: "levar os pedidos consolidados da base até os clientes" },
};

// /hub/convite/:token — a pessoa entra com a conta PlaceFit, preenche os dados e o perfil nasce pendente.
export default function ConviteAceitar({ logado, onAceito }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [convite, setConvite] = useState(null);
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ nome: "", whatsapp: "", documento: "", veiculo: "", cidades: "", ufs: "" });
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!logado) return;
    hub("ver_convite", { token })
      .then((c) => { setConvite(c); setF((x) => ({ ...x, nome: c.nome_sugerido || "", whatsapp: c.whatsapp_sugerido || "" })); })
      .catch((e) => setErro(e.message));
  }, [logado, token]);

  if (!logado) {
    return (
      <Cartao className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Você recebeu um convite do Hub PlaceFit</h1>
        <p className="text-sm text-slate-600">Para continuar, entre com sua conta PlaceFit. Se ainda não tem, você cria na mesma tela, de graça.</p>
        <Button className="h-12 w-full text-base" onClick={() => base44.auth.redirectToLogin(window.location.href)}>
          <LogIn className="mr-2 h-5 w-5" />Entrar ou criar conta
        </Button>
        <Link to="/hub" className="block text-sm font-medium text-emerald-700">Ver como o Hub funciona</Link>
      </Cartao>
    );
  }

  if (feito) {
    return (
      <Cartao className="mx-auto max-w-md space-y-4 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-900">Cadastro enviado!</h1>
        <p className="text-sm text-slate-600">
          A PlaceFit vai conferir seus dados e liberar seu acesso. Quando for liberado, a fila aparece aqui no Hub, entrando com esta mesma conta.
        </p>
        <Button className="h-12 w-full" onClick={() => { navigate("/hub", { replace: true }); onAceito?.(); }}>Ir para o Hub</Button>
      </Cartao>
    );
  }

  if (erro && !convite) {
    return (
      <Cartao className="mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">Não foi possível abrir o convite</h1>
        <p className="text-sm text-slate-600">{erro}</p>
        <Link to="/hub" className="block text-sm font-medium text-emerald-700">Ver como o Hub funciona</Link>
      </Cartao>
    );
  }

  if (!convite) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;

  const papel = PAPEL[convite.tipo];
  const Icone = papel.icone;

  if (convite.ja_tem_perfil) {
    return (
      <Cartao className="mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">Você já é {papel.nome} no Hub</h1>
        <p className="text-sm text-slate-600">Sua conta já tem esse perfil. Este convite não é necessário.</p>
        <Button className="w-full" onClick={() => navigate("/hub", { replace: true })}>Ir para o Hub</Button>
      </Cartao>
    );
  }

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      await hub("aceitar_convite", { token, ...f });
      setFeito(true);
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Cartao className="flex gap-3 bg-emerald-50 p-5">
        <Icone className="mt-0.5 h-8 w-8 shrink-0 text-emerald-700" />
        <div>
          <h1 className="text-lg font-bold text-slate-900">Convite para {papel.nome}</h1>
          <p className="text-sm text-slate-700">Você vai {papel.faz}. Preencha seus dados; a PlaceFit confere e libera seu acesso.</p>
        </div>
      </Cartao>

      <Cartao className="space-y-3">
        <Campo rotulo="Nome completo"><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo rotulo="WhatsApp com DDD"><Input inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="37 99999-0000" /></Campo>
        <Campo rotulo="CPF ou CNPJ"><Input inputMode="numeric" value={f.documento} onChange={(e) => set("documento", e.target.value)} /></Campo>
        <Campo rotulo="Veículo e placa"><Input value={f.veiculo} onChange={(e) => set("veiculo", e.target.value)} placeholder="Fiorino branca ABC1D23" /></Campo>
        {convite.tipo === "coletor" && (
          <Campo rotulo="Cidades que você atende (separe por vírgula; em branco = todas)">
            <Input value={f.cidades} onChange={(e) => set("cidades", e.target.value)} placeholder="Cláudio, Itaúna, Carmo do Cajuru" />
          </Campo>
        )}
        {convite.tipo === "fretista" && (
          <Campo rotulo="Estados de destino que você atende (siglas; em branco = todos)">
            <Input value={f.ufs} onChange={(e) => set("ufs", e.target.value)} placeholder="MG, SP, RJ" />
          </Campo>
        )}
        <Erro texto={erro} />
        <Button className="h-12 w-full text-base" disabled={enviando} onClick={enviar}>
          {enviando && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Enviar cadastro
        </Button>
      </Cartao>
      <Link to="/hub/como-funciona" className="block text-center text-sm font-medium text-emerald-700">Como o Hub funciona</Link>
    </div>
  );
}
