# Skill: Confecção de PDF de Catálogo / Tabela B2B

> Aprendizado consolidado de melhores práticas para gerar PDFs de catálogo de produtos
> (cards agrupados ou tabela densa) a partir de HTML/CSS impresso no navegador.

## Princípios Fundamentais

### 1. Margens de Página (@page)
- **SEMPRE** definir `@page { size: A4; margin: 12mm 15mm; }` — nunca confiar no "Nenhuma" do browser.
- Margem mínima segura: **10mm** (lateral), **12mm** (topo/rodapé).
- Para catálogos com capa: **15mm** lateral, **20mm** topo.
- Margens espelhadas (`margin: 12mm 15mm 15mm 15mm`) evam corte em impressão física.

### 2. Fontes e Legibilidade
- Fonte mínima **9pt** para corpo de texto; **7pt** apenas para dados densos (SKU, código).
- `line-height: 1.4-1.6` para texto corrido; `1.2` para tabelas densas.
- Usar fontes do sistema (Arial, Helvetica) — fontes web não carregam no `window.open()`.
- `color: #1e293b` (cinza-escuro) para texto; nunca `#000` puro (cansa a leitura).

### 3. Grid e Espaçamento
- **Gutter mínimo de 8px** entre cards — nunca colar borda com borda.
- **Padding interno mínimo de 8px** nos cards — texto nunca toca a borda.
- Grid de 3 colunas em A4 retrato: cada coluna ≈ 58mm útil (com margem 15mm).
- `gap: 12px` é o sweet spot para catálogos B2B.

### 4. Quebra de Página
- `page-break-inside: avoid` (ou `break-inside: avoid`) em cada card/produto.
- `thead { display: table-header-group }` para repetir cabeçalho de tabela.
- `page-break-after: avoid` no título de categoria (não separar título dos cards).
- **Nunca** forçar `page-break-before: always` em cada item — desperdiça papel.

### 5. Cores e Impressão
- `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }` — OBRIGATÓRIO.
- Sem isso, Chrome ignora `background-color` de chips/badges.
- Fundos muito claros (`#f8fafc`, `#eff6ff`) podem não aparecer — usar no mínimo `#e0e7ff`.

### 6. Imagens
- Converter para **base64 data URL** antes de escrever o HTML de impressão.
- URLs externas não carregam a tempo no `window.open()` + `print()`.
- `object-fit: contain` com `background: #fff` para fotos de produto.
- Aguardar `img.onload` de TODAS as imagens antes de chamar `print()`.

### 7. Estrutura do Documento
```
[Capa/Cabeçalho]     → logo + nome + contato (repete no topo de cada página via thead)
[Índice]             → pills de categorias com contadores
[Corpo]              → grid de cards ou tabela, agrupado por categoria
[Rodapé]             → total de itens + data + disclaimer
```

## Anti-Padrões (NÃO FAZER)

| Erro | Consequência | Correção |
|---|---|---|
| Sem `@page margin` | Conteúdo colado na borda | `@page { margin: 12mm 15mm }` |
| `gap: 0` ou sem gap | Cards grudados | `gap: 12px` mínimo |
| Sem `print-color-adjust` | Chips/badges sem cor | `* { print-color-adjust: exact }` |
| URL de imagem direta | Imagem em branco no PDF | Converter para base64 |
| `font-size: 6pt` | Ilegível | Mínimo 7pt (densos) / 9pt (normal) |
| `page-break-before: always` por item | 1 item por folha | `break-inside: avoid` por card |
| Imprimir iframe do builder | Página em branco | `window.open('', '_blank')` + clone DOM |

## Estrutura CSS Recomendada

```css
@page { size: A4 portrait; margin: 12mm 15mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: white; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1e293b; }

/* Tabela que repete cabeçalho */
.catalogo-document { width: 100%; table-layout: fixed; border-collapse: collapse; }
.catalogo-document thead { display: table-header-group; }
.catalogo-document tr { break-inside: avoid; page-break-inside: avoid; }
.catalogo-document td { vertical-align: top; padding: 6px; }

/* Cards não quebram entre páginas */
[data-catalogo-card] { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }

/* Título de categoria não se separa dos cards */
[data-catalogo-category-title] { break-after: avoid; page-break-after: avoid; }

/* Foto de produto */
[data-catalogo-photo] img { width: 64px; height: 64px; object-fit: contain; background: #fff; }
```

## Fluxo de Exportação (JavaScript)

1. `window.open('', '_blank')` — janela limpa, não o iframe do builder.
2. Clonar o DOM visível do catálogo (não regenerar do zero).
3. Copiar estilos computados (`getComputedStyle`) para preservar cores/layout.
4. Converter imagens para base64 e aguardar `onload`.
5. `await document.fonts.ready` — garantir fontes carregadas.
6. `requestAnimationFrame` duplo — garantir render completa.
7. `printWindow.focus(); printWindow.print();` — focar e imprimir.

## Validação Final (Checklist)

- [ ] Margens laterais visíveis (não colado na borda)
- [ ] Espaçamento entre cards (gutter ≥ 8px)
- [ ] Padding interno nos cards (≥ 8px)
- [ ] Cores dos chips/badges aparecendo
- [ ] Imagens carregadas (não em branco)
- [ ] Cabeçalho repetido em cada página
- [ ] Cards não cortados entre páginas
- [ ] Fonte mínima 7pt legível
- [ ] Rodapé com total de itens