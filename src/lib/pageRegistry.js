// Performance (13/10): carregamento sob demanda das páginas.
//
// O pages.config.js (gerado automaticamente pelo Base44) importa todas as páginas de forma
// estática, o que colocava as ~80 telas num único arquivo de ~2,9 MB baixado em toda abertura.
// Aqui lemos o pages.config.js como TEXTO (?raw) só para saber quais páginas existem e qual é a
// principal — assim páginas novas continuam sendo registradas sozinhas — e cada página vira um
// pedaço separado, baixado apenas quando o usuário abre aquela tela.
import { lazy } from 'react';
import pagesConfigSource from '@/pages.config.js?raw';

const pageLoaders = import.meta.glob('../pages/*.jsx');

// O arquivo traz um exemplo de PAGES dentro do comentário do topo: remove os comentários antes de ler
const configCode = pagesConfigSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const pagesBlock = configCode.match(/export const PAGES\s*=\s*\{([\s\S]*?)\}/);
export const PAGE_KEYS = pagesBlock
  ? [...pagesBlock[1].matchAll(/"([^"]+)"\s*:/g)].map(m => m[1])
  : [];

const mainPageMatch = configCode.match(/mainPage\s*:\s*"([^"]+)"/);
export const MAIN_PAGE = mainPageMatch ? mainPageMatch[1] : PAGE_KEYS[0];

const cache = {};
export function lazyPage(name) {
  if (!cache[name]) {
    const loader = pageLoaders[`../pages/${name}.jsx`];
    cache[name] = loader ? lazy(loader) : null;
  }
  return cache[name];
}

export const LAZY_PAGES = Object.fromEntries(
  PAGE_KEYS.map(key => [key, lazyPage(key)]).filter(([, Page]) => Page)
);
