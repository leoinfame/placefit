# Checkpoint Fiscal — Estado anterior à reforma segura

> **Data:** 2026-09-18
> **Escopo:** Entidades e páginas fiscais do PlaceFit
> **Objetivo:** Ponto de rollback documentado antes da preparação da base fiscal segura

## Estado original (antes das alterações)

### Entidades e suas configurações de segurança

| Entidade | x-security (antes) | RLS (antes) | Campos sensíveis |
|---|---|---|---|
| `NotaFiscal` | read/create/update/delete = authenticated | **nenhuma** | `chave_acesso`, `protocolo`, `xml_url`, `danfe_url` (todos aceitam string livre) |
| `ConfiguracaoFiscal` | read/create/update/delete = authenticated | **nenhuma** | `senha_certificado` (texto puro), `certificado_a1` (URL), `cfop_padrao` default "5102" |
| `ClienteFiscal` | read/create/update/delete = authenticated | **nenhuma** | — |
| `PedidoVenda` | read/create/update/delete = authenticated | **nenhuma** | status inclui "Faturado" sem SEFAZ |
| `PedidoCompra` | read/create/update/delete = **public** | **nenhuma** | **acesso público total** |

### Páginas e comportamentos

| Página | Problema |
|---|---|
| `FinanceiroFiscal.jsx` | Links para `/NotasFiscais`, `/FinanceiroContas`, `/FreteEntrega` (rotas inexistentes); botão "Emitir NF-e" |
| `ConfiguracaoFiscal.jsx` | Upload de certificado (disabled), `cfop_padrao` fixado em "5102", sem checklist de pendências |
| `PedidosVenda.jsx` | Botão "Emitir NF-e" (linha 493-496) em pedidos confirmados sem handler seguro |
| `ClientesFiscais.jsx` | Sem RLS na entidade |
| `/NotasFiscais` | **Rota não existe** (link quebrado em FinanceiroFiscal) |

### Funções backend
- Nenhuma função fiscal segura existia antes deste checkpoint.

## Como reverter

Cada entidade e página tem versionamento automático na plataforma. Para reverter:
1. **Entidades:** restaurar versão anterior via dashboard de versões da plataforma (cada `write_file` cria uma versão).
2. **Páginas:** restaurar versão anterior via dashboard de versões.
3. **Funções backend:** deletar `base44/functions/prepararRascunhoFiscal/` se criada.
4. **Nova entidade EventoFiscal:** pode ser removida sem impacto (nova, sem dados).

## O que NÃO foi tocado
- Fluxo WAHA/QR (crm-whatsapp, crm-whatsapp-webhook)
- Fluxo WhatsApp Meta (whatsappWebhook, whatsappCoexistence)
- Atendente IA
- Marketplace, Lojas, Pedidos de Compra (fluxo operacional)
- Dados reais de clientes (nenhum registro foi migrado ou alterado)
- Integrações Stripe, Google Merchant, Meta Catalog