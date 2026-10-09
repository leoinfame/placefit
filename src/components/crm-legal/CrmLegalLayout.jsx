import React, { useEffect } from "react";
import { Link } from "react-router-dom";

// Páginas legais do CRM MuscularFit — públicas (sem login).
// Base: crm-muscularfit-pages-confirmado-2026-10-07.zip (Drive, pasta
// "Backups - PlaceFit") + decisões do dono de 09/10/2026 (descarte manual,
// exclusão só pelo número cadastrado, treino de IA no plano Builder).
// Só mudar redação com nova aprovação.

export const CRM_LEGAL_ROUTES = {
  privacidade: "/crm/privacidade",
  termos: "/crm/termos",
  exclusao: "/crm/exclusao-de-dados",
};

export const VIGENCIA = "9 de outubro de 2026";

export const RESPONSAVEL = "Maria do Carmo Chagas de Moura (MEI), CNPJ 41.920.834/0001-00, nome fantasia MuscularFit";

/** Link entre os três documentos. */
export function DocLink({ to, children }) {
  return (
    <Link to={to} className="text-[#365f54] underline">
      {children}
    </Link>
  );
}

export function H2({ children }) {
  return <h2 className="mb-3 mt-8 font-serif text-2xl font-normal leading-snug">{children}</h2>;
}

export function P({ children }) {
  return <p className="my-3">{children}</p>;
}

export default function CrmLegalLayout({ titulo, tituloAba, children }) {
  useEffect(() => {
    const anterior = document.title;
    document.title = tituloAba;
    return () => {
      document.title = anterior;
    };
  }, [tituloAba]);

  return (
    <div className="min-h-screen bg-white text-base leading-relaxed text-[#251f21] [font-family:Arial,sans-serif]">
      <header className="border-b border-[#eae9ea] bg-[#f4efec] p-5 sm:p-6">
        <b className="text-lg">CRM MuscularFit</b>
        <span className="mt-1.5 block text-[13px] text-[#585254]">Vigência: {VIGENCIA}</span>
        <nav className="mt-3 flex flex-wrap gap-3.5 text-sm">
          <DocLink to={CRM_LEGAL_ROUTES.privacidade}>Privacidade</DocLink>
          <DocLink to={CRM_LEGAL_ROUTES.termos}>Termos</DocLink>
          <DocLink to={CRM_LEGAL_ROUTES.exclusao}>Exclusão de dados</DocLink>
        </nav>
      </header>
      <main className="mx-auto max-w-[820px] px-5 pb-12 pt-5 sm:px-6 sm:pt-7">
        <h1 className="my-5 font-serif text-[28px] font-normal leading-tight sm:text-[32px]">{titulo}</h1>
        {children}
        <footer className="mt-10 border-t border-[#eae9ea] pt-5 text-[13px] text-[#585254]">
          MuscularFit • Plataforma PlaceFit
        </footer>
      </main>
    </div>
  );
}
