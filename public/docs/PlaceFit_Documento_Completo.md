# PLACEFIT — Documento Completo da Plataforma
### Visão Geral para Apresentação a Investidor

**Data:** Setembro de 2026  
**Versão do App:** Produção  
**URL:** https://placefit.base44.app

---

## 1. O QUE É A PLACEFIT

A PlaceFit é uma plataforma B2B SaaS + Marketplace que conecta **fabricantes**, **revendedores** e **transportadores** do mercado fitness brasileiro em um único ecossistema digital. A missão é eliminar atravessadores, reduzir custos e profissionalizar a cadeia de suprimentos do mercado fitness — da cotação à entrega.

### Proposta de Valor

> **"Da cotação à entrega. Toda a sua operação fitness em um só lugar."**

A PlaceFit substitui o modelo tradicional — onde revendedores compram de distribuidores com margens infladas — por um modelo direto fabricante → revendedor → cliente final, com ferramentas de gestão, e-commerce, automação comercial e logística integradas.

### Diferenciais Competitivos

1. **Catálogo centralizado de 2.490 produtos** padronizados (templates) com comparação de preços entre múltiplos fabricantes
2. **Sem atravessador** — revendedor acessa preço de fábrica diretamente
3. **E-commerce próprio** para cada revendedor, com checkout, frete e pagamentos integrados
4. **Integração nativa** com Google Shopping, Meta Commerce (WhatsApp Business) e Mercado Livre
5. **CRM de WhatsApp** com atendente de IA opcional
6. **Importação internacional** da China com gestão de escrow e documentos aduaneiros
7. **Cobrança recorrente** via Stripe (cartão, PIX, boleto) com gestão de assinaturas

---

## 2. MÉTRICAS ATUAIS (Setembro 2026)

### Usuários
| Tipo | Quantidade |
|------|-----------|
| Administradores | 5 |
| Revendedores | 14 |
| Fabricantes (com login) | 15 |
| Transportadores | 1 |
| **Total de Usuários** | **35** |

### Fabricantes Cadastrados
- **16 fabricantes** cadastrados na plataforma (entidade Fabricante)
- **13 aprovados** e visíveis no catálogo público
- Fabricantes podem operar sem login próprio (gerenciados pelo admin) ou com acesso próprio

### Catálogo de Produtos
| Métrica | Valor |
|---------|-------|
| Templates de produtos (SKU padronizado) | 2.490 |
| Supplier Products (preços vinculados) | 4.225 |
| Categorias de produto | 13 |

**Distribuição por categoria:**
| Categoria | Templates |
|-----------|-----------|
| Dumbbells | 1.063 |
| Acessórios | 253 |
| Anilhas | 336 |
| Barras | 216 |
| Halteres | 201 |
| Tijolinhos | 115 |
| Kettlebells | 95 |
| Puxadores | 61 |
| Kits | 55 |
| Suportes | 52 |
| Estruturas | 17 |
| Colchonetes | 10 |
| Outros | 11 |
| Pisos | 5 |

### E-commerce
| Métrica | Valor |
|---------|-------|
| Lojas online criadas | 4 |
| Lojas ativas/publicadas | 3 |
| Pedidos recebidos | 10 |

### Compras Internacionais
- **9 fabricantes chineses** cadastrados
- Sistema de pedidos com escrow, conversão de moeda (RMB/USD → BRL) e geração de Commercial Invoice + Packing List

### Logística
- **20 estados** cobertos pela tabela de frete (cálculo automático por peso e destino)

### Receita Recorrente (SaaS)
| Plano | Preço Mensal | Assinaturas Ativas |
|-------|-------------|-------------------|
| Mensalidade PlaceFit (base) | R$ 180,00 | 17 |
| Catálogo WhatsApp | R$ 59,90 | 0 |
| Conta de Vendedores | R$ 100,00 | 0 |
| Compras Internacionais | R$ 120,00 | 0 |
| **Total de assinaturas ativas** | | **17** |

**MRR estimado (apenas mensalidade base):** 17 × R$ 180 = **R$ 3.060/mês**

---

## 3. TIPOS DE USUÁRIO E USABILIDADE

A plataforma possui **4 perfis de usuário** com fluxos e permissões totalmente distintos, mais o **cliente final** da loja online (sem login no sistema principal).

### 3.1 ADMINISTRADOR

O administrador é o operador da PlaceFit. Tem controle total sobre a plataforma.

**Funcionalidades:**
- **Gestão de Usuários:** aprovar/reprovar revendedores, fabricantes e transportadores; convidar usuários; atribuir roles
- **Gestão de Serviços (AdminServicos):** criar/editar planos e preços; liberar acessos manualmente; suspender/cancelar assinaturas; visualizar todos os assinantes
- **Catálogo Mestre (Produtos):** gerenciar templates de produtos (ProductTemplate); criar/editar/fundir templates; gerenciar atributos (cores, acabamentos, tipos); importar tabelas de fabricantes em CSV/Excel
- **Gestão de Fabricantes:** cadastrar fabricantes (com ou sem login); vincular usuário a fabricante; configurar acordos comerciais (comissão, markup, prazos); aprovar fabricantes no catálogo público
- **Gestão de Revendedores:** visualizar todos os revendedores; gerenciar aprovações
- **Gestão de Clientes:** visualizar todos os clientes cadastrados
- **CRM WhatsApp:** acesso a todas as conversas
- **Tabela de Frete:** configurar fretes por estado (valor fixo + preço por kg)
- **Atendente IA:** configurar base de conhecimento e comportamento do atendente
- **Marketplace:** gerenciar vitrine pública
- **E-commerce Lojas:** gerenciar todas as lojas online dos revendedores
- **Convites e Treinamento:** gerenciar onboarding de novos usuários
- **Versões:** publicar changelog de atualizações
- **Suporte:** canal de atendimento

**Modo de Visualização:** o admin pode alternar entre visualizar a plataforma como Admin, Revendedor, Fabricante ou Transportador — simulando a experiência de cada perfil sem trocar de conta.

---

### 3.2 FABRICANTE

O fabricante é o fornecedor que cadastra seus produtos e preços na plataforma. Pode ser gerenciado pelo admin (sem login) ou ter acesso próprio.

**Funcionalidades:**
- **Catálogo Geral:** visualizar todos os 2.490 templates de produtos disponíveis na plataforma
- **Meus Produtos:** vincular seus preços aos templates; definir preço de fábrica; configurar disponibilidade; definir se paga comissão para revendedor
- **Importar Tabela:** subir planilha CSV/Excel com seus preços; o sistema mapeia automaticamente os produtos aos templates existentes via SKU
- **Sua Tabela (Export):** gerar tabela de preços em PDF com a marca do fabricante; exportar CSV
- **Catálogo WhatsApp (opcional):** publicar catálogo no WhatsApp Business via Meta Commerce
- **Pedidos:** receber e gerenciar pedidos de compra dos revendedores
- **Orçamentos:** criar orçamentos para clientes
- **Vendas:** gerenciar vendas e clientes
- **CRM WhatsApp:** atendimento comercial via WhatsApp
- **Perfil:** cadastrar logomarca, história da empresa, formas de pagamento, prazos de entrega/produção, informações de frete, política de troca

**Fluxo de Onboarding:**
1. Admin cadastra o fabricante (ou fabricante se registra via formulário público)
2. Fabricante sobe sua tabela de preços (CSV/Excel)
3. Sistema mapeia produtos aos templates via SKU
4. Admin aprova o fabricante → aparece no catálogo público
5. Revendedores veem os preços e podem adicionar à sua tabela

**Acordo Comercial:**
- Fabricante define se **paga comissão** para revendedor (percentual sobre o preço de fábrica)
- Fabricante define **markup sugerido** (margem de revenda)
- Revendedor pode ajustar sua própria margem

---

### 3.3 REVENDEDOR

O revendedor é o usuário central da plataforma — é quem compra dos fabricantes e vende para o cliente final. É o perfil com mais funcionalidades.

**Funcionalidades Principais:**

#### Catálogo e Produtos
- **Catálogo Geral:** navegar pelos 2.490 templates; comparar preços entre fabricantes; filtrar por categoria, peso, acabamento
- **Meus Produtos:** adicionar produtos ao seu catálogo pessoal; definir margem de revenda; definir preço promocional (sale_price); publicar/ocultar produtos; editar em massa (margem, disponibilidade); exportar CSV
- **Sua Tabela (Export):** gerar tabela de preços personalizada em PDF com sua marca; preço exibido já com margem aplicada; exportar CSV

#### E-commerce (Loja Online)
- **Minha Loja Online:** criar e configurar loja online pública (slug, nome, logo, banner, cores, descrição)
- **Configurações de Pagamento:** aceitar PIX, cartão, boleto ou dinheiro na entrega
- **Frete:** frete fixo ou tabela por estado (MuscularFit)
- **Domínio Próprio:** configurar domínio customizado (ex: loja.muscularfit.com.br) — obrigatório para Google Merchant Center
- **Pedidos da Loja:** receber e gerenciar pedidos do e-commerce; pedidos caem automaticamente no sistema
- **Clientes da Loja:** clientes finais se cadastram na loja (LojaCliente); espelhados automaticamente na entidade Cliente do revendedor

#### Integrações de Marketplace
- **Google Shopping:** feed automico de produtos para Google Merchant Center; sincronização de preços e estoque; domínio próprio para verificação
- **Meta Commerce (WhatsApp):** feed de catálogo para WhatsApp Business; push instantâneo de alterações; pausar/reativar sem perder a URL
- **Mercado Livre:** integração OAuth; mapeamento automático de categorias; exportação de anúncios (formato Novo + Clássico, sem frete grátis)

#### CRM e Atendimento
- **CRM WhatsApp:** gerenciar conversas comerciais; templates de mensagens; histórico de atendimento; sincronização com WhatsApp
- **Atendente IA (opcional):** atendente de IA que responde clientes automaticamente via WhatsApp; configurável (base de conhecimento, instruções customizadas por fabricante)
- **Catálogo WhatsApp (opcional):** publicar catálogo de produtos no WhatsApp Business

#### Vendas e Financeiro
- **Orçamentos:** criar orçamentos profissionais; converter orçamento em venda com um clique; gerar PDF
- **Vendas:** gerenciar pedidos de venda; histórico de clientes
- **Meus Clientes:** cadastrar e gerenciar clientes (CPF/CNPJ, endereço, telefone)
- **Pedidos de Compra:** gerar pedidos de compra para fabricantes com um clique; acompanhar status (pendente → confirmado → em separação → enviado → entregue)
- **Financeiro:** controle financeiro básico; documentos fiscais (quando configurado)

#### Conta e Assinaturas
- **Minha Conta:** gerenciar assinaturas (mensalidade base + recursos avulsos); cadastrar cartão de crédito (Stripe); pagar via PIX/boleto; ver faturas e histórico; cancelar recursos
- **Perfil:** dados da empresa (CNPJ, endereço, WhatsApp, site, logomarca)

**Fluxo de Onboarding do Revendedor:**
1. Cadastro via homepage pública (Google Login)
2. Sistema cria assinatura trial automaticamente (função `inscreverApp`)
3. Tour guiado de primeiros passos
4. Revendedor adiciona produtos do catálogo geral à sua tabela
5. Define margens e preços
6. Opcionalmente: cria loja online, conecta Google Shopping, configura WhatsApp
7. Começa a vender — gera orçamentos, recebe pedidos, faz pedidos de compra aos fabricantes

---

### 3.4 TRANSPORTADOR

O transportador é o parceiro logístico que oferece fretes para os revendedores.

**Funcionalidades:**
- **Minhas Rotas:** cadastrar rotas de frete por estado e cidade; definir preço por peso; definir observações
- **Ofertas de Frete:** visualizar solicitações de frete dos revendedores; ofertar valores
- **Perfil:** cadastrar dados da transportadora (CNPJ, contato, cobertura)

**Fluxo:**
1. Transportador se registra via formulário público
2. Admin aprova o cadastro
3. Transportador cadastra suas rotas e preços
4. Revendedores veem as ofertas ao calcular frete para seus clientes

---

### 3.5 CLIENTE FINAL (Loja Online)

O cliente final não tem login no sistema principal — apenas na loja online do revendedor.

**Funcionalidades (Loja Pública):**
- **Navegação:** navegar pelo catálogo de produtos do revendedor; buscar por categoria/nome
- **Cadastro/Login:** criar conta na loja (nome, email, CPF, telefone, senha); login com email/senha
- **Carrinho:** adicionar produtos ao carrinho; calcular frete por CEP; ver total
- **Checkout:** escolher forma de pagamento (PIX, cartão, boleto, dinheiro); informar endereço de entrega; finalizar pedido
- **Minha Conta (Loja):** ver pedidos; atualizar endereço; ver política de devolução
- **Produto:** ver detalhes do produto (foto, descrição, preço, especificações)

**Fluxo de Compra:**
1. Cliente acessa a loja (ex: /loja/muscularfit)
2. Navega pelo catálogo, adiciona ao carrinho
3. Faz login ou cadastro (obrigatório para checkout)
4. Calcula frete pelo CEP
5. Escolhe pagamento e finaliza
6. Pedido cai no painel do revendedor (LojaPedido)
7. Revendedor processa: confirma → gera pedido de compra ao fabricante → organiza entrega

---

## 4. MODELO DE NEGÓCIO

### 4.1 Receita Recorrente (SaaS)

A PlaceFit opera com **mensalidade base obrigatória** + **recursos avulsos opcionais**.

| Plano | Slug | Preço/Mês | Descrição |
|-------|------|----------|-----------|
| Mensalidade PlaceFit | `mensalidade_padrao` | R$ 180,00 | Acesso base a todos os recursos essenciais (obrigatório) |
| Catálogo WhatsApp | `CW` | R$ 59,90 | Publicação de catálogo no WhatsApp Business via Meta Commerce |
| Conta de Vendedores | `CV` | R$ 100,00 | Sub-contas para vendedores da empresa do revendedor |
| Compras Internacionais | `CI` | R$ 120,00 | Acesso ao módulo de importação da China com escrow |

**Condições Comerciais:**
- **10% de desconto** no plano anual, parcelado em até 12x no cartão
- Cobrança via **Stripe** (cartão de crédito recorrente, PIX, boleto)
- Mensalidade base é **obrigatória** para ativação do usuário
- Recursos avulsos aparecem no menu apenas se contratados

### 4.2 Cobrança e Pagamento

- **Stripe Integration:** checkout seguro, cartão salvo para cobrança recorrente, webhook de eventos de pagamento
- **PIX e Boleto:** geração de QR Code e código de barras via Stripe
- **Faturas:** histórico completo de cobranças (FaturaAssinatura) com status (pendente, pago, atrasado, cancelado, estornado)
- **Gestão de Cartão:** cadastro e remoção de cartão via Stripe Elements (PCI-compliant)
- **Auto-ativação:** no primeiro login, o sistema processa a inscrição e cria a assinatura trial automaticamente

### 4.3 Potencial de Monetização Futura

- **Take rate sobre transações** do e-commerce (atualmente 0%)
- **Comissão sobre pedidos de compra** fabricante → revendedor
- **Premium para fabricantes** (destaque no catálogo, analytics)
- **API access** para integradores externos
- **White-label** para grandes redes

---

## 5. ARQUITETURA TÉCNICA

### 5.1 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Base44 (BaaS) — serverless functions em Deno/TypeScript |
| Banco de Dados | MongoDB (via Base44 entities) |
| Autenticação | Google OAuth + Base44 Auth |
| Pagamentos | Stripe (cartão, PIX, boleto) |
| Realtime | WebSockets (Base44 realtime subscriptions) |
| PWA | Instalável (manifest.json, service worker) |
| Hospedagem | Base44 Cloud (https://placefit.base44.app) |
| Mobile | Publica para iOS/Android a partir do mesmo código |

### 5.2 Entidades de Dados (35+ entidades)

**Catálogo:**
- `ProductTemplate` — 2.490 SKUs padronizados do mercado fitness
- `SupplierProduct` — 4.225 vínculos de preço entre fornecedores e templates
- `Category`, `Unit`, `AtributoConfig` — metadados de categorização

**Usuários e Empresas:**
- `User` — built-in (admin, revendedor, fabricante, transportador)
- `Fabricante` — cadastro de fabricantes (independente de User)
- `FabricanteChina` — 9 fornecedores internacionais
- `AcordoFabricante`, `AcordoComissao` — acordos comerciais

**Comercial:**
- `Pedido` — orçamentos e vendas
- `PedidoVenda` — pedidos de venda
- `PedidoCompra` — pedidos de compra (revendedor → fabricante)
- `PedidoChina` — pedidos de importação internacional
- `Cliente`, `ClienteFiscal` — clientes do revendedor

**E-commerce:**
- `LojaConfig` — configuração da loja online
- `LojaCliente` — clientes finais da loja
- `LojaPedido` — pedidos do e-commerce
- `SupplierSkuMap` — mapeamento de SKUs

**Assinaturas e Pagamento:**
- `PlanoServico` — planos disponíveis
- `AssinaturaUsuario` — assinaturas ativas
- `FaturaAssinatura` — histórico de cobranças
- `MetodoPagamento` — cartões salvos no Stripe

**Logística:**
- `TabelaFrete` — fretes por estado (20 estados)
- `FreightOffer` — ofertas de frete de transportadores
- `TransportadorRota` — rotas dos transportadores

**CRM e IA:**
- `CRMConversa`, `CRMMensagem`, `CRMTemplate` — CRM de WhatsApp
- `AIKnowledge`, `IAConfig` — base de conhecimento do atendente IA
- `ChatHistory` — histórico de chat

**Sistema:**
- `Notification` — notificações in-app
- `AppVersion` — changelog
- `InscricaoApp` — intents de inscrição da homepage
- `PreCadastro` — pré-cadastros do admin

### 5.3 Backend Functions (45+ funções serverless)

**Catálogo e Produtos:**
- `getProdutosData`, `getAllProducts`, `getCatalogoData`
- `getFabricanteProducts`, `getFabricantes`, `getFabricanteNames`
- `importarTabelaFabricante`, `processDirectCsvUpload`, `processSupplierTableUpload`
- `confirmarImportacaoTabela`, `normalizarCatalogo`
- `updateSupportProductsCategory`, `semearSkuMapHistorico`

**E-commerce:**
- `getStoreData`, `createStoreOrder`, `confirmarPagamentoLoja`
- `getClienteArea`, `updateClienteEndereco`, `authCliente`

**Feeds de Marketplace:**
- `catalogoFeedGoogle`, `catalogoFeedMeta`, `lojaFeedMeta`
- `syncToGoogleMerchant`, `syncCatalogoWhatsapp`
- `checkGoogleMerchantProduct`

**Mercado Livre:**
- `mlAuth`, `mlExportarProdutos`

**Pagamentos (Stripe):**
- `setupPaymentMethod`, `savePaymentMethod`, `removerCartao`
- `chargeSavedCard`, `gerarCobrancaPixBoleto`
- `stripeWebhook`, `contratarRecurso`, `cancelarRecurso`

**Assinaturas:**
- `inscreverApp`, `aplicarPreCadastro`

**CRM e WhatsApp:**
- `crm-whatsapp`, `crm-whatsapp-webhook`, `whatsappWebhook`
- `ia_webhook`

**Admin:**
- `adminUpdateUser`, `getPedidosCompraComFabricante`
- `getPublicFabricanteTable`, `testKp4Debug`

### 5.4 Segurança (RLS — Row-Level Security)

A plataforma implementa isolamento de dados por usuário:
- Revendedores só veem seus próprios produtos, pedidos, clientes e lojas
- Fabricantes só veem seus produtos e pedidos
- Clientes da loja só veem seus próprios pedidos
- Cartões de crédito só são visíveis pelo dono ou admin
- Faturas só são visíveis pelo dono ou admin

### 5.5 Performance e Confiabilidade

- **ErrorBoundary global** em todas as rotas — evita telas brancas
- **Realtime subscriptions** — atualização em tempo real de dados
- **PWA instalável** — funciona como app nativo no celular
- **Responsivo** — mobile-first, funciona em desktop e mobile
- **Cache de queries** via React Query (TanStack)

---

## 6. INTEGRAÇÕES EXTERNAS

### 6.1 Stripe
- Cobrança recorrente de assinaturas
- Pagamento via cartão, PIX e boleto
- Webhook para eventos de pagamento
- PCI-compliant (cartão nunca passa pelo servidor)

### 6.2 Google Shopping
- Feed automático de produtos (XML)
- Sincronização com Google Merchant Center
- Verificação de domínio próprio do lojista
- Service Account JSON configurada

### 6.3 Meta Commerce (WhatsApp Business)
- Feed de catálogo para WhatsApp
- Push instantâneo de alterações de produto
- Pausar/reativar catálogo sem perder a URL
- Token de acesso ao catálogo

### 6.4 Mercado Livre
- OAuth (autorização do revendedor)
- Mapeamento automático de categorias
- Exportação de anúncios (formato Novo + Clássico)
- Sem frete grátis (política da plataforma)

### 6.5 WhatsApp (CRM)
- CRM de conversas comerciais
- Templates de mensagens
- Sincronização via webhook
- Atendente de IA opcional

### 6.6 IA (LLM)
- Atendente de IA para WhatsApp
- Base de conhecimento configurável
- Instruções customizadas por fabricante
- Geração de respostas contextuais

---

## 7. JORNADAS PRINCIPAIS

### 7.1 Jornada do Revendedor (Core Loop)

```
Cadastro → Ativação automática → Tour guiado
    ↓
Explora Catálogo Geral (2.490 produtos, compara preços)
    ↓
Adiciona produtos à "Meus Produtos" (define margem)
    ↓
Gera "Sua Tabela" (PDF com marca + margem aplicada)
    ↓
Cria Orçamento para cliente → Converte em Venda
    ↓
Gera Pedido de Compra para fabricante
    ↓
[Opcional] Cria Loja Online → Recebe pedidos automáticos
    ↓
[Opcional] Publica no Google Shopping / WhatsApp / ML
    ↓
[Opcional] Contrata Atendente IA para WhatsApp
```

### 7.2 Jornada do Fabricante

```
Cadastro (admin ou auto-registro) → Aprovação do admin
    ↓
Sobe tabela de preços (CSV/Excel) → Mapeamento automático
    ↓
Define acordo comercial (comissão, markup)
    ↓
Recebe pedidos de compra dos revendedores
    ↓
[Opcional] Publica catálogo no WhatsApp Business
    ↓
Gera tabela de preços em PDF com sua marca
```

### 7.3 Jornada do Cliente Final (E-commerce)

```
Acessa loja (ex: /loja/muscularfit)
    ↓
Navega catálogo → Adiciona ao carrinho
    ↓
Cadastro/Login (email + senha)
    ↓
Calcula frete por CEP → Escolhe pagamento
    ↓
Finaliza pedido → Pedido cai no painel do revendedor
    ↓
Revendedor confirma → Gera pedido de compra → Organiza entrega
```

---

## 8. PÁGINAS E MÓDULOS DO SISTEMA

### Páginas Públicas (sem login)
- `/` — Homepage pública com apresentação e planos
- `/Marketplace` — Vitrine pública de produtos
- `/PublicTableFabricante` — Tabela pública de um fabricante
- `/FabricanteCatalogoPublic/:id` — Catálogo público de fabricante
- `/fabricantes/:slug` — Perfil público de fabricante
- `/loja/:slug` — Loja online pública do revendedor
- `/loja/:slug/produto/:cod` — Produto da loja
- `/loja/:slug/conta` — Área do cliente da loja
- `/loja/:slug/politica-devolucao` — Política de devolução

### Páginas Autenticadas
- **Dashboard** — Painel principal com estatísticas
- **Produtos** — Hub de catálogo (tabs: Catálogo Geral, Meus Produtos, Importar, Admin)
- **Fabricantes** — Lista de fabricantes (varia por perfil)
- **Clientes** — Gestão de clientes
- **Orcamentos** — Criação e gestão de orçamentos
- **Vendas** — Pedidos de venda
- **PedidosCompra** — Pedidos de compra (revendedor → fabricante)
- **Financeiro** — Controle financeiro
- **Export** — "Sua Tabela" (PDF/CSV personalizado)
- **LojaRevendedor** — Configuração da loja online
- **LojaEcommerce** — Gestão de e-commerce (admin)
- **CRMWhatsApp** — CRM de WhatsApp
- **CatalogoWhatsApp** — Configuração do catálogo WhatsApp
- **AtendenteIA / AtendenteIARevendedor** — Atendente de IA
- **ConfigurarIA** — Configuração do atendente
- **MinhaConta** — Assinaturas, pagamento, faturas
- **Servicos** — Contratação de recursos avulsos
- **AdminServicos** — Gestão de planos e assinaturas (admin)
- **TabelaFrete** — Configuração de fretes (admin)
- **Atributos** — Gestão de atributos de produtos (admin)
- **Usuarios** — Gestão de usuários (admin)
- **Convite** — Convites de usuários
- **Treinamento** — Onboarding guiado
- **Suporte** — Canal de suporte
- **Profile** — Perfil do usuário
- **ComprasInternacionais** — Importação da China
- **FinanceiroFiscal** / **ClientesFiscais** / **ConfiguracaoFiscal** — Módulo fiscal

---

## 9. O QUE ESTÁ PRONTO vs. EM DESENVOLVIMENTO

### ✅ Pronto e em Produção
- Catálogo centralizado com 2.490 templates e 4.225 preços
- 16 fabricantes cadastrados (13 aprovados)
- 35 usuários ativos (17 assinantes pagantes)
- E-commerce com 3 lojas ativas e 10 pedidos processados
- Cobrança recorrente via Stripe (cartão, PIX, boleto)
- CRM de WhatsApp
- Feed para Google Shopping
- Feed para Meta Commerce (WhatsApp)
- Integração com Mercado Livre (OAuth + exportação)
- Importação da China (9 fabricantes, escrow, documentos)
- Tabela de frete (20 estados)
- PWA instalável
- Atendente de IA (opcional)
- Onboarding guiado

### 🔄 Em Evolução / Próximos Passos
- Aumentar base de revendedores (atualmente 14)
- Ativar contratações de recursos avulsos (CW, CV, CI — atualmente 0)
- Expandir pedidos no e-commerce (atualmente 10)
- Take rate sobre transações do e-commerce
- Analytics e dashboard de insights para revendedores
- App mobile nativo (iOS/Android via publish)
- Marketplace de transportadores mais robusto
- API pública para integradores

---

## 10. OPORTUNIDADE DE MERCADO

### Tamanho do Mercado
O mercado fitness brasileiro movimenta **R$ 10+ bilhões/ano** em equipamentos, com milhares de revendedores e centenas de fabricantes. O mercado é fragmentado, com pouca digitalização e dependência de catálogos em PDF, planilhas e WhatsApp manual.

### Problema Resolvido
- **Revendedores** não têm visibilidade de preços entre fabricantes e dependem de distribuidores
- **Fabricantes** não têm canal direto com revendedores e perdem margem para intermediários
- **Processo manual** de cotação, tabela de preços, orçamentos e pedidos é lento e propenso a erro
- **E-commerce** é caro e complexo para pequenos revendedores montarem
- **Integração com marketplaces** (Google, WhatsApp, ML) é técnica e inacessível

### Solução PlaceFit
Uma plataforma única que resolve toda a cadeia: do catálogo de fábrica à venda ao cliente final, com e-commerce, CRM, logística e gestão financeira integrados — por uma mensalidade acessível (R$ 180/mês).

### Tração Atual
- **17 assinantes ativos** pagando R$ 180/mês = R$ 3.060 MRR
- **16 fabricantes** no catálogo (13 aprovados)
- **2.490 produtos** padronizados
- **3 lojas online** ativas
- **9 fornecedores internacionais** cadastrados
- Base sólida para escalar: produto pronto, integrações funcionais, modelo de cobrança validado

### Projeção (Cenário Conservador)
| Milestone | Revendedores | MRR | ARR |
|-----------|-------------|-----|-----|
| Atual | 14 | R$ 3.060 | R$ 36.720 |
| +6 meses | 50 | R$ 9.000+ | R$ 108.000+ |
| +12 meses | 150 | R$ 27.000+ | R$ 324.000+ |
| +24 meses | 500 | R$ 90.000+ | R$ 1.080.000+ |

*Projeção considera apenas mensalidade base (R$ 180/mês). Recursos avulsos e take rate de transações são adicionais.*

---

## 11. IDENTIDADE VISUAL

- **Nome:** PlaceFit
- **Tagline:** "Da cotação à entrega. Toda a sua operação fitness em um só lugar."
- **Posicionamento:** "Sem atravessador!"
- **Paleta:** Azul (#1e40af) + Verde industrial (#059669) + Branco/Grafite
- **Estilo:** Industrial minimalista, profissional, limpo
- **Logo:** https://media.base44.com/images/public/68c9d5dd3cf0f8fd8a834875/574e5a0a6_logo-ico-removebg-preview1.png

---

## 12. CONTATO E PRÓXIMOS PASSOS

A PlaceFit está pronta para escalar. O produto está em produção, o modelo de cobrança está validado e as integrações críticas (Stripe, Google, Meta, Mercado Livre) estão operacionais.

**Investimento buscado para:**
- Aquisição de revendedores (marketing e vendas)
- Expansão da base de fabricantes
- Desenvolvimento de features de retenção (analytics, app mobile)
- Time de sucesso do cliente e suporte

---

*Documento gerado em setembro de 2026 com dados em tempo real da plataforma.*
