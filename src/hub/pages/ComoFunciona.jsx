import React from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart, ClipboardCheck, Factory, PackageSearch, Warehouse, Boxes, Truck,
  QrCode, ShieldCheck, MapPin, Wallet, AlertTriangle, Store, Building2, UserPlus,
} from "lucide-react";
import { useHub } from "../components/HubContexto";

// Pagina explicativa do Hub: o caminho do pedido, quem faz o que e as regras.
// Aparece para todos (inclusive quem ainda nao tem acesso) e e o material de apresentacao para convidados.
const ETAPAS = [
  { icone: ShoppingCart, titulo: "Venda fechada", texto: "A revenda fecha a venda no PlaceFit, pelo painel ou com pagamento na vitrine. Cada fabricante do pedido vira um subpedido." },
  { icone: ClipboardCheck, titulo: "Pedido entra no Hub", texto: "A PlaceFit inclui o pedido, confere o fabricante de cada subpedido, o valor da coleta e o destino. Cada subpedido ganha uma etiqueta com QR." },
  { icone: Factory, titulo: "Fabricante prepara", texto: "Quando a mercadoria fica pronta, a base confirma com o fabricante e libera a coleta na fila." },
  { icone: PackageSearch, titulo: "Coletor escolhe e coleta", texto: "O coletor vê a fila da sua região com endereço, peso e valor, aceita as coletas que quer, combina o horário e retira no fabricante escaneando a etiqueta." },
  { icone: Warehouse, titulo: "Chega na base", texto: "O coletor entrega no galpão. A base escaneia a etiqueta, confere item por item e registra qualquer diferença." },
  { icone: Boxes, titulo: "Pedido consolidado", texto: "Com todos os subpedidos conferidos, a base junta o pedido inteiro e gera a etiqueta mestre." },
  { icone: Truck, titulo: "Fretista entrega", texto: "O fretista vê o frete do seu estado, aceita, retira na base e entrega ao cliente, registrando quem recebeu." },
];

const PAPEIS = [
  { icone: Store, titulo: "Revenda", texto: "Vende e acompanha cada etapa da entrega em “Meus pedidos”." },
  { icone: Building2, titulo: "PlaceFit", texto: "Coloca os pedidos no Hub, define valores, verifica as pessoas e cuida do financeiro." },
  { icone: Factory, titulo: "Fabricante", texto: "Prepara a mercadoria e entrega ao coletor na hora combinada." },
  { icone: PackageSearch, titulo: "Coletor", texto: "Busca nos fabricantes da sua região e leva até a base." },
  { icone: Warehouse, titulo: "Base", texto: "Recebe, confere, consolida e libera o pedido para o frete." },
  { icone: Truck, titulo: "Fretista", texto: "Leva o pedido consolidado da base até o cliente." },
];

const REGRAS = [
  { icone: QrCode, texto: "Toda passagem de mão é registrada com a etiqueta (QR) e foto. Sempre fica claro com quem está a mercadoria." },
  { icone: ShieldCheck, texto: "Só quem foi verificado pela PlaceFit vê a fila e aceita serviço." },
  { icone: MapPin, texto: "Cada um vê só o que atende: o coletor pelas cidades da sua região, o fretista pelos estados de destino." },
  { icone: Wallet, texto: "O valor da coleta é lançado quando a base confere; o do frete, quando o cliente recebe." },
  { icone: AlertTriangle, texto: "Se o coletor chega e a mercadoria não está pronta, ele registra a falsa coleta com foto e o fabricante paga a taxa." },
];

export default function ComoFunciona() {
  const ctx = useHub();
  const admin = !!ctx?.admin;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-6">
      <section className="rounded-3xl bg-slate-900 px-5 py-8 text-white sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Hub PlaceFit</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">Do fabricante ao cliente, com cada passagem registrada.</h1>
        <p className="mt-3 text-sm text-slate-300 sm:text-base">
          O Hub junta os pedidos do polo de Cláudio num só fluxo: o coletor busca nos fabricantes, a base confere e
          consolida, e o fretista entrega. Todo mundo vê o que precisa, na hora certa.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">O caminho do pedido</h2>
        <ol className="space-y-0">
          {ETAPAS.map(({ icone: Icone, titulo, texto }, i) => (
            <li key={titulo} className="relative flex gap-4 pb-5">
              {i < ETAPAS.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-0.5 bg-emerald-200" aria-hidden />}
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Icone className="h-5 w-5" />
              </span>
              <div className="pt-1">
                <p className="font-semibold text-slate-900"><span className="mr-1 text-emerald-700">{i + 1}.</span>{titulo}</p>
                <p className="mt-0.5 text-sm text-slate-600">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Quem faz o quê</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAPEIS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <Icone className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-900">{titulo}</p>
                <p className="text-sm text-slate-600">{texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Regras do Hub</h2>
        <ul className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          {REGRAS.map(({ icone: Icone, texto }) => (
            <li key={texto} className="flex gap-3 text-sm text-slate-700">
              <Icone className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-emerald-700" />
          <h2 className="text-lg font-bold text-slate-900">Quer ser coletor ou fretista?</h2>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          A entrada é por convite. Pelo link do convite você entra com sua conta PlaceFit (ou cria uma), preenche seus dados
          e veículo, e a PlaceFit confere e libera seu acesso à fila.
        </p>
        {admin ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link to="/hub/admin/convites?tipo=coletor" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">
              <PackageSearch className="h-5 w-5" />Convidar coletor
            </Link>
            <Link to="/hub/admin/convites?tipo=fretista" className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">
              <Truck className="h-5 w-5" />Convidar fretista
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-emerald-800">Ainda não tem convite? Peça o seu à PlaceFit.</p>
        )}
      </section>
    </div>
  );
}
