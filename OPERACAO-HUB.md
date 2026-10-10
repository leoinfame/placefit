# Operação do Hub PlaceFit

Documentação viva da operação do Hub (logística fabricante → base → cliente). É a base do material de treino da base e dos coletores. **Atualize este arquivo junto com qualquer mudança de fluxo no código** (`src/hub/`, `base44/functions/hubApi/`, `base44/shared/hubFluxo.ts`).

- Piloto: revenda **MuscularFit** (flag `hub_muscularfit`). Revenda sem a flag ligada não vê nada do Hub.
- Endereço: `/hub` no app PlaceFit (futuro: `hub.placefit.com.br`). Mesmo login da loja.
- Última revisão: 10/10/2026 — versão 2 (destino do pedido da vitrine, peso antes de aceitar, checklist de conferência).

## Quem faz o quê

| Perfil | Onde | O que faz |
|---|---|---|
| Admin (conta com papel admin) | `/hub/admin` | Inclui pedidos no Hub, define valores, marca pronto, atribui, acompanha ao vivo, paga. Também opera a tela da Base. |
| Base (galpão) | `/hub/base` | Marca pronto, imprime etiquetas, recebe, confere item a item, consolida, libera para frete. |
| Coletor | `/hub/coletor` | Fabricante → base. Aceita da fila, confirma janela, coleta, entrega na base. |
| Fretista | `/hub/fretista` | Base → cliente. Aceita da fila, retira na base, entrega ao cliente. |
| Revenda | `/hub/acompanhar` e sino na loja | Só acompanha. |

Coletor, fretista e base só veem a fila depois que o admin marca o perfil como **verificado** (Admin → Cadastros → Pessoas).

## Timeline do pedido (corrigida)

1. **A revenda fecha o pedido.** Pode ser venda feita no painel (orçamento → venda) ou pedido pago na vitrine. O sistema cria um subpedido (`PedidoCompra`) por fabricante.

2. **Admin inclui no Hub** — Admin → Pedidos → *Incluir no Hub*.
   - Confere o fabricante de cada subpedido (o sistema sugere pelo nome; o endereço de coleta vem do cadastro do fabricante).
   - Define o **valor da coleta** de cada fabricante (pode ficar para depois, mas sem valor não dá para marcar pronto).
   - **Peso**: o campo já mostra a estimativa do catálogo. Em branco = usa a estimativa. Se algum item não tem peso no catálogo, a estimativa é parcial (o coletor vê "≥ X kg"); se nenhum tem, informe o peso.
   - **Destino**: vem sozinho do endereço de entrega do pedido da vitrine ou, se não houver, do cadastro do cliente. A tela diz de onde veio. Corrija ou preencha à mão se faltar.
   - Define o **valor do frete** (pode ficar para depois; sem valor não dá para liberar o frete).

3. **Fabricante confirma que está pronto.** No piloto o fabricante não tem login: ele avisa no WhatsApp → admin ou base clicam **Marcar pronto** e escrevem como ele confirmou (quem, que horas). Esta é a única etapa sem foto. Só aí a coleta entra na fila dos coletores.

4. **Base imprime as etiquetas.** Base → *Etiquetas do dia* lista **as coletas já marcadas como prontas** que ainda não saíram do fabricante. Uma etiqueta (QR) por subpedido. Para imprimir a etiqueta de uma coleta antes de ela estar pronta: Admin → Pedidos → botão *Etiqueta* da coleta.

5. **Coletor aceita.** Na fila ele vê, antes de aceitar: fabricante, cidade, volumes, **peso**, itens e **valor**. Aceita → confirma a **janela** (horário em que vai buscar), combinada com o fabricante. A janela é o coletor quem define, depois de aceitar.

6. **Coleta no fabricante.** Coletor cola a etiqueta no volume, escaneia o QR e tira a foto → evento *coletado no fabricante* → a base é notificada.
   - **Falsa coleta**: chegou e não estava pronto → *Não estava pronto*, com foto e explicação. Lança a taxa (padrão R$ 50) com o **fabricante como devedor** e o **coletor como favorecido**. A coleta volta para *aguardando fabricante* e precisa ser **marcada pronta de novo**.

7. **Entrega na base.** Coletor escaneia o QR + foto na chegada → *entregue na base*. Se o coletor esquecer, a **base pode registrar o recebimento** (Conferir chegada → *Receber na base*).

8. **Conferência (item a item).** Base → *Conferir chegada* → escaneia a etiqueta → aparece a lista de itens do subpedido. Toque em cada item que veio completo; item não marcado pede **quantos vieram** (0 = faltou). A **divergência nasce do que não foi marcado** (ex.: "Veio 3 de 4: Anilha 10kg"), mais uma observação livre opcional (avaria, embalagem). **Foto do volume obrigatória.** Ao confirmar → *conferido* → o pagamento do coletor é lançado automaticamente no financeiro.

9. **Consolidação (duas etapas).** Quando **todos** os subpedidos do pedido estão conferidos:
   1. Base → *Consolidar pedido* → *Imprimir etiqueta mestre* (gera o QR mestre do pacote).
   2. Base cola a etiqueta e **escaneia o QR mestre + foto** → *pedido consolidado* → **o admin é notificado só neste momento**.

10. **Liberação do frete.** Admin define/confirma o valor do frete; a base (ou o admin) clica *Liberar para a fila de frete*. Sem valor de frete, não libera.

11. **Retirada.** Fretista aceita (vê cidade/UF de destino, volumes, peso e valor antes) → na base escaneia o **QR mestre** + foto → *retirado* → **a revenda é notificada: saiu para entrega**.

12. **Entrega final.** Fretista escaneia o QR mestre + foto + **nome de quem recebeu** → *entregue* → **a revenda é notificada de novo (entregue)** → o pagamento do fretista é lançado.

13. **Pagamentos (manual no piloto).** Admin → Financeiro: registra o pagamento ao coletor/fretista (data, forma, comprovante). Na taxa de falsa coleta há **dois controles**: *receber do fabricante* e *pagar ao coletor*.

## Regras que o sistema garante

- **Cada QR só vale na etapa certa** e no serviço certo: etiqueta de subpedido não serve onde se pede o QR mestre (e vice-versa); escanear de novo a mesma etapa é recusado; pular etapa é recusado.
- **Foto obrigatória em toda batida de custódia** (coletado, entregue na base, conferido, consolidado, retirado, entregue) e na falsa coleta. Marcar pronto não tem foto.
- Hora do servidor, hora do aparelho e localização (quando o celular permite) ficam gravadas em cada evento. Sem permissão de localização o evento é aceito e fica marcado "sem localização".
- Eventos de custódia **não podem ser editados nem apagados**.
- **Limite de valor**: é o que o admin preencher no perfil do coletor/fretista. **Em branco = sem limite** (não é automático para quem é novo). Coleta acima do limite não aparece na fila daquela pessoa.
- **Região**: coletor só vê fabricantes das cidades do perfil (vazio = todas). Fabricante **sem cidade no cadastro aparece para todos**. Fretista vê pelas UFs do perfil.
- **Quem vê o quê**: revenda sem a flag não vê nada. Coletores, fretistas e base veem as próprias telas mesmo não sendo da MuscularFit, **desde que o perfil esteja verificado**. Valores e financeiro completos, só o admin.
- Dois coletores aceitando ao mesmo tempo: fica com quem gravou por último; o outro recebe "outro coletor aceitou primeiro".

## Divergências da primeira timeline (10/10/2026)

A primeira versão do material de treino tinha 7 pontos que não batiam com o sistema. Registro para não voltarem:

| # | O que dizia | Como é | Situação |
|---|---|---|---|
| 1 | Base imprime etiquetas (passo 3) antes do fabricante confirmar (passo 4) | *Etiquetas do dia* só lista coletas já prontas. Ordem real: marcar pronto → imprimir. Etiqueta antecipada: Admin → Pedidos → *Etiqueta* | Corrigido na timeline |
| 2 | Coletor vê peso e janela antes de aceitar | Peso: agora sim (estimado pelo catálogo ou informado). Janela: não — o coletor define depois de aceitar | Peso **resolvido no sistema (v2)**; janela corrigida na timeline |
| 3 | Conferência com checklist item a item | Não existia (só foto + texto livre) | **Resolvido no sistema (v2)**: checklist item a item, divergência gerada do que não foi marcado |
| 4 | Ao consolidar nasce o QR e o admin é notificado | São duas etapas: gerar/imprimir o QR mestre; o admin só é avisado quando a base escaneia o QR mestre com foto | Corrigido na timeline |
| 5 | Revenda notificada na entrega | Notificada duas vezes: saiu para entrega e entregue | Corrigido na timeline |
| 6 | Coletor novo tem limite de valor | Limite é o que o admin preencher; em branco = sem limite | Corrigido nas regras |
| 7 | Quem não é da MuscularFit não vê nada | Vale para revendas. Coletores/fretistas/base veem as telas deles quando verificados | Corrigido nas regras |

Também ficou de fora da primeira timeline e agora está documentado: a coleta volta para *aguardando fabricante* depois de falsa coleta; a base pode registrar a entrega se o coletor esquecer; marcar pronto não tem foto; a taxa de falsa coleta tem dois controles no financeiro.

## Glossário de status

**Coleta (subpedido):** aguardando fabricante → na fila → aceita → janela confirmada → coletada → na base → conferida. Saídas: falsa coleta (volta para aguardando fabricante), cancelada.

**Frete (pedido completo):** aguardando consolidação → consolidado → na fila → aceito → saiu para entrega → entregue. Saída: cancelado.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Coletor não vê a coleta | Perfil não verificado; cidade fora da região; valor acima do limite; coleta não marcada pronta; ele recusou antes | Conferir em Cadastros e no status da coleta |
| "Marcar pronto" desabilitado | Coleta sem valor definido | Admin define o valor em Pedidos |
| "Liberar para frete" não aparece | Frete sem valor | Admin define o valor do frete |
| "Etiquetas do dia" vazio | Nenhuma coleta pronta | Marcar pronto primeiro, ou imprimir pela tela de Pedidos |
| QR recusado | QR de outro serviço, da etapa errada ou já usado | Ler a mensagem: ela diz qual etiqueta é |
| Fretista sem cidade de destino | Pedido sem endereço na vitrine e no cadastro | Admin preenche o destino ao incluir |
| Coletor vê "peso a confirmar" | Nenhum item com peso no catálogo e peso não informado | Admin informa o peso na linha da coleta |

## Para desenvolvedores

- Regras puras: `base44/shared/hubFluxo.ts` — testes: `deno run base44/shared/hubFluxo.test.ts`
- API: `base44/functions/hubApi/entry.ts` (toda gravação passa por aqui) — teste de ponta a ponta contra banco em memória: `deno run --allow-all base44/shared/hub-e2e/e2e.ts`
- Telas: `src/hub/`. Na loja, só `src/App.jsx` (rota `/hub/*`) e o sino em `src/Layout.jsx`.
- Proteção de acesso das entidades é só o bloco `rls` (o Base44 não aplica `x-security`).
