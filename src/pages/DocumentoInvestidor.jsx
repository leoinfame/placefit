import React from "react";

const PLACEFIT_LOGO =
  "https://media.base44.com/images/public/68c9d5dd3cf0f8fd8a834875/574e5a0a6_logo-ico-removebg-preview1.png";

const styles = {
  body: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "linear-gradient(135deg, #f0f4ff 0%, #ecfdf5 100%)",
    color: "#1e293b",
    lineHeight: 1.7,
    minHeight: "100vh",
  },
  container: { maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" },
  hero: {
    textAlign: "center", padding: "48px 32px", background: "white",
    borderRadius: 20, marginBottom: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
  },
  h1: {
    fontSize: "2.4rem", fontWeight: 800,
    background: "linear-gradient(135deg, #1e40af, #059669)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text", marginBottom: 8, lineHeight: 1.2,
  },
  h2: {
    fontSize: "1.6rem", fontWeight: 700, color: "#1e3a5f",
    marginTop: 48, marginBottom: 16, paddingBottom: 8, borderBottom: "3px solid #e0e7ff",
  },
  h3: { fontSize: "1.25rem", fontWeight: 700, color: "#334155", marginTop: 32, marginBottom: 12 },
  h4: { fontSize: "1.05rem", fontWeight: 600, color: "#475569", marginTop: 24, marginBottom: 8 },
  p: { marginBottom: 12, color: "#475569" },
  subtitle: { fontSize: "1.1rem", color: "#64748b", marginBottom: 4 },
  meta: { fontSize: "0.85rem", color: "#94a3b8", marginBottom: 32 },
  ul: { marginLeft: 24, marginBottom: 16 },
  li: { marginBottom: 6, color: "#475569" },
  section: {
    background: "white", borderRadius: 16, padding: 32, margin: "24px 0",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  },
  table: {
    width: "100%", borderCollapse: "collapse", margin: "16px 0",
    background: "white", borderRadius: 12, overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  th: {
    background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "white",
    padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: "0.9rem",
  },
  td: { padding: "10px 16px", borderTop: "1px solid #e2e8f0", fontSize: "0.9rem", color: "#475569" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, margin: "20px 0" },
  statCard: {
    background: "white", borderRadius: 12, padding: 20, textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0",
  },
  statNum: {
    fontSize: "2rem", fontWeight: 800,
    background: "linear-gradient(135deg, #1e40af, #059669)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  },
  statLabel: { fontSize: "0.8rem", color: "#64748b", marginTop: 4 },
  blockquote: {
    borderLeft: "4px solid #059669", background: "#ecfdf5", padding: "16px 20px",
    margin: "16px 0", borderRadius: "0 8px 8px 0", fontStyle: "italic", color: "#065f46",
  },
  pre: {
    background: "#1e293b", color: "#e2e8f0", padding: 20, borderRadius: 12,
    overflowX: "auto", margin: "16px 0", fontSize: "0.85rem", lineHeight: 1.5,
  },
  cta: {
    display: "inline-block", marginTop: 20, padding: "12px 32px",
    background: "linear-gradient(135deg, #1e40af, #059669)", color: "white",
    textDecoration: "none", borderRadius: 12, fontWeight: 600, border: "none", cursor: "pointer",
  },
  pill: {
    display: "inline-block", background: "linear-gradient(135deg, #dbeafe, #d1fae5)",
    border: "1px solid #bfdbfe", borderRadius: 999, padding: "6px 16px",
    fontSize: "0.85rem", color: "#1e40af", fontWeight: 500, margin: 4,
  },
  badge: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600 },
  badgeGreen: { background: "#dcfce7", color: "#166534" },
  badgeAmber: { background: "#fef3c7", color: "#92400e" },
  hr: { border: "none", borderTop: "1px solid #e2e8f0", margin: "32px 0" },
  footer: { textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" },
};

const Th = ({ children }) => <th style={styles.th}>{children}</th>;
const Td = ({ children }) => <td style={styles.td}>{children}</td>;

export default function DocumentoInvestidor() {
  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <img src={PLACEFIT_LOGO} alt="PlaceFit" style={{ width: 64, marginBottom: 16 }} />
          <h1 style={styles.h1}>PLACEFIT — Documento Completo da Plataforma</h1>
          <p style={styles.subtitle}>Visão Geral para Apresentação a Investidor</p>
          <p style={styles.meta}>Setembro de 2026 • Produção • placefit.base44.app</p>
          <button style={styles.cta} onClick={() => window.print()}>📄 Imprimir / Salvar PDF</button>
        </div>

        {/* 1. O QUE É */}
        <div style={styles.section}>
          <h2 style={styles.h2}>1. O que é a PlaceFit</h2>
          <p style={styles.p}>A PlaceFit é uma plataforma <strong>B2B SaaS + Marketplace</strong> que conecta <strong>fabricantes</strong>, <strong>revendedores</strong> e <strong>transportadores</strong> do mercado fitness brasileiro em um único ecossistema digital. A missão é eliminar atravessadores, reduzir custos e profissionalizar a cadeia de suprimentos do mercado fitness — da cotação à entrega.</p>
          <blockquote style={styles.blockquote}>Da cotação à entrega. Toda a sua operação fitness em um só lugar.</blockquote>
          <h3 style={styles.h3}>Diferenciais Competitivos</h3>
          <ol style={styles.ul}>
            <li style={styles.li}><strong>Catálogo centralizado de 2.490 produtos</strong> padronizados com comparação de preços entre múltiplos fabricantes</li>
            <li style={styles.li}><strong>Sem atravessador</strong> — revendedor acessa preço de fábrica diretamente</li>
            <li style={styles.li}><strong>E-commerce próprio</strong> para cada revendedor, com checkout, frete e pagamentos integrados</li>
            <li style={styles.li}><strong>Integração nativa</strong> com Google Shopping, Meta Commerce (WhatsApp Business) e Mercado Livre</li>
            <li style={styles.li}><strong>CRM de WhatsApp</strong> com atendente de IA opcional</li>
            <li style={styles.li}><strong>Importação internacional</strong> da China com gestão de escrow e documentos aduaneiros</li>
            <li style={styles.li}><strong>Cobrança recorrente</strong> via Stripe (cartão, PIX, boleto) com gestão de assinaturas</li>
          </ol>
        </div>

        {/* 2. MÉTRICAS */}
        <div style={styles.section}>
          <h2 style={styles.h2}>2. Métricas Atuais (Setembro 2026)</h2>
          <div style={styles.cardGrid}>
            {[
              { num: "35", label: "Usuários Totais" },
              { num: "17", label: "Assinantes Ativos" },
              { num: "2.490", label: "Produtos no Catálogo" },
              { num: "16", label: "Fabricantes" },
              { num: "R$ 3.060", label: "MRR (Receita Mensal)" },
              { num: "3", label: "Lojas Online Ativas" },
            ].map((s) => (
              <div key={s.label} style={styles.statCard}>
                <div style={styles.statNum}>{s.num}</div>
                <div style={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <h3 style={styles.h3}>Usuários por Tipo</h3>
          <table style={styles.table}>
            <thead><tr><Th>Tipo</Th><Th>Quantidade</Th></tr></thead>
            <tbody>
              {[["Administradores", 5], ["Revendedores", 14], ["Fabricantes (com login)", 15], ["Transportadores", 1]].map(([t, q]) => (
                <tr key={t}><Td>{t}</Td><Td>{q}</Td></tr>
              ))}
              <tr><Td><strong>Total</strong></Td><Td><strong>35</strong></Td></tr>
            </tbody>
          </table>

          <h3 style={styles.h3}>Catálogo por Categoria</h3>
          <table style={styles.table}>
            <thead><tr><Th>Categoria</Th><Th>Templates</Th></tr></thead>
            <tbody>
              {[["Dumbbells", 1063], ["Anilhas", 336], ["Acessórios", 253], ["Barras", 216], ["Halteres", 201], ["Tijolinhos", 115], ["Kettlebells", 95], ["Puxadores", 61], ["Kits", 55], ["Suportes", 52], ["Estruturas", 17], ["Outros", 11], ["Colchonetes", 10], ["Pisos", 5]].map(([c, q]) => (
                <tr key={c}><Td>{c}</Td><Td>{q.toLocaleString("pt-BR")}</Td></tr>
              ))}
            </tbody>
          </table>

          <h3 style={styles.h3}>Receita Recorrente (SaaS)</h3>
          <table style={styles.table}>
            <thead><tr><Th>Plano</Th><Th>Preço/Mês</Th><Th>Assinaturas Ativas</Th></tr></thead>
            <tbody>
              <tr><Td>Mensalidade PlaceFit (base, obrigatório)</Td><Td>R$ 180,00</Td><Td>17</Td></tr>
              <tr><Td>Catálogo WhatsApp</Td><Td>R$ 59,90</Td><Td>0</Td></tr>
              <tr><Td>Conta de Vendedores</Td><Td>R$ 100,00</Td><Td>0</Td></tr>
              <tr><Td>Compras Internacionais</Td><Td>R$ 120,00</Td><Td>0</Td></tr>
            </tbody>
          </table>
          <p style={styles.p}><strong>MRR estimado:</strong> 17 × R$ 180 = <strong>R$ 3.060/mês</strong> (apenas mensalidade base)</p>
        </div>

        {/* 3. TIPOS DE USUÁRIO */}
        <div style={styles.section}>
          <h2 style={styles.h2}>3. Tipos de Usuário e Usabilidade</h2>

          <h3 style={styles.h3}>3.1 Administrador</h3>
          <p style={styles.p}>Operador da PlaceFit com controle total.</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Gestão de Usuários:</strong> aprovar/reprovar revendedores, fabricantes e transportadores; convidar; atribuir roles</li>
            <li style={styles.li}><strong>Gestão de Serviços:</strong> criar/editar planos e preços; liberar acessos; suspender/cancelar assinaturas</li>
            <li style={styles.li}><strong>Catálogo Mestre:</strong> gerenciar 2.490 templates; criar/editar/fundir templates; gerenciar atributos; importar tabelas CSV/Excel</li>
            <li style={styles.li}><strong>Gestão de Fabricantes:</strong> cadastrar (com ou sem login); vincular usuário; configurar acordos comerciais; aprovar no catálogo público</li>
            <li style={styles.li}><strong>CRM WhatsApp, Tabela de Frete, Atendente IA, Marketplace, E-commerce, Convites, Treinamento, Versões, Suporte</strong></li>
          </ul>
          <p style={styles.p}><span style={{ ...styles.badge, ...styles.badgeGreen }}>Modo Visualização</span> O admin pode alternar entre visualizar como Admin, Revendedor, Fabricante ou Transportador.</p>

          <h3 style={styles.h3}>3.2 Fabricante</h3>
          <p style={styles.p}>Fornecedor que cadastra produtos e preços. Pode ser gerenciado pelo admin (sem login) ou ter acesso próprio.</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Catálogo Geral:</strong> visualizar todos os 2.490 templates</li>
            <li style={styles.li}><strong>Meus Produtos:</strong> vincular preços aos templates; definir preço de fábrica; configurar disponibilidade; definir comissão</li>
            <li style={styles.li}><strong>Importar Tabela:</strong> subir CSV/Excel; mapeamento automático via SKU</li>
            <li style={styles.li}><strong>Sua Tabela:</strong> gerar PDF com a marca; exportar CSV</li>
            <li style={styles.li}><strong>Catálogo WhatsApp (opcional):</strong> publicar no WhatsApp Business</li>
            <li style={styles.li}><strong>Pedidos:</strong> receber e gerenciar pedidos de compra dos revendedores</li>
            <li style={styles.li}><strong>Orçamentos, Vendas, CRM WhatsApp, Perfil</strong> (logomarca, história, formas de pagamento, prazos)</li>
          </ul>

          <h3 style={styles.h3}>3.3 Revendedor</h3>
          <p style={styles.p}>Usuário central da plataforma — compra de fabricantes e vende ao cliente final. Perfil com mais funcionalidades.</p>

          <h4 style={styles.h4}>Catálogo e Produtos</h4>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Catálogo Geral:</strong> navegar 2.490 templates; comparar preços entre fabricantes; filtrar por categoria, peso, acabamento</li>
            <li style={styles.li}><strong>Meus Produtos:</strong> adicionar ao catálogo pessoal; definir margem; preço promocional; publicar/ocultar; edição em massa; exportar CSV</li>
            <li style={styles.li}><strong>Sua Tabela:</strong> PDF personalizado com marca e margem aplicada; exportar CSV</li>
          </ul>

          <h4 style={styles.h4}>E-commerce (Loja Online)</h4>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Minha Loja Online:</strong> criar loja pública (slug, nome, logo, banner, cores, descrição)</li>
            <li style={styles.li}><strong>Pagamentos:</strong> PIX, cartão, boleto ou dinheiro na entrega</li>
            <li style={styles.li}><strong>Frete:</strong> frete fixo ou tabela por estado</li>
            <li style={styles.li}><strong>Domínio próprio:</strong> configurar domínio customizado (obrigatório para Google Merchant Center)</li>
            <li style={styles.li}><strong>Pedidos da Loja:</strong> receber e gerenciar; pedidos caem automaticamente no sistema</li>
          </ul>

          <h4 style={styles.h4}>Integrações de Marketplace</h4>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Google Shopping:</strong> feed automático; sincronização de preços; domínio próprio para verificação</li>
            <li style={styles.li}><strong>Meta Commerce (WhatsApp):</strong> feed de catálogo; push instantâneo; pausar/reativar</li>
            <li style={styles.li}><strong>Mercado Livre:</strong> OAuth; mapeamento automático de categorias; exportação (Novo + Clássico, sem frete grátis)</li>
          </ul>

          <h4 style={styles.h4}>CRM e Atendimento</h4>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>CRM WhatsApp:</strong> gerenciar conversas; templates; histórico; sincronização via webhook</li>
            <li style={styles.li}><strong>Atendente IA (opcional):</strong> responde clientes automaticamente via WhatsApp; base de conhecimento configurável</li>
            <li style={styles.li}><strong>Catálogo WhatsApp (opcional):</strong> publicar catálogo no WhatsApp Business</li>
          </ul>

          <h4 style={styles.h4}>Vendas e Financeiro</h4>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Orçamentos:</strong> criar orçamentos profissionais; converter em venda com um clique; gerar PDF</li>
            <li style={styles.li}><strong>Vendas:</strong> gerenciar pedidos; histórico de clientes</li>
            <li style={styles.li}><strong>Meus Clientes:</strong> cadastrar (CPF/CNPJ, endereço, telefone)</li>
            <li style={styles.li}><strong>Pedidos de Compra:</strong> gerar para fabricantes com um clique; acompanhar status</li>
            <li style={styles.li}><strong>Financeiro:</strong> controle financeiro; documentos fiscais</li>
          </ul>

          <h4 style={styles.h4}>Conta e Assinaturas</h4>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Minha Conta:</strong> gerenciar assinaturas; cadastrar cartão (Stripe); pagar via PIX/boleto; ver faturas; cancelar recursos</li>
          </ul>

          <h3 style={styles.h3}>3.4 Transportador</h3>
          <p style={styles.p}>Parceiro logístico que oferece fretes.</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Minhas Rotas:</strong> cadastrar rotas por estado e cidade; preço por peso</li>
            <li style={styles.li}><strong>Ofertas de Frete:</strong> visualizar solicitações; ofertar valores</li>
            <li style={styles.li}><strong>Perfil:</strong> cadastrar dados da transportadora</li>
          </ul>

          <h3 style={styles.h3}>3.5 Cliente Final (Loja Online)</h3>
          <p style={styles.p}>Sem login no sistema principal — apenas na loja online do revendedor.</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Navegação:</strong> catálogo de produtos; buscar por categoria/nome</li>
            <li style={styles.li}><strong>Cadastro/Login:</strong> criar conta (nome, email, CPF, telefone, senha)</li>
            <li style={styles.li}><strong>Carrinho:</strong> adicionar produtos; calcular frete por CEP; ver total</li>
            <li style={styles.li}><strong>Checkout:</strong> escolher pagamento (PIX, cartão, boleto, dinheiro); informar endereço; finalizar</li>
            <li style={styles.li}><strong>Minha Conta (Loja):</strong> ver pedidos; atualizar endereço; ver política de devolução</li>
          </ul>
        </div>

        {/* 4. MODELO DE NEGÓCIO */}
        <div style={styles.section}>
          <h2 style={styles.h2}>4. Modelo de Negócio</h2>
          <h3 style={styles.h3}>Receita Recorrente (SaaS)</h3>
          <p style={styles.p}>Mensalidade base obrigatória + recursos avulsos opcionais.</p>
          <table style={styles.table}>
            <thead><tr><Th>Plano</Th><Th>Preço/Mês</Th><Th>Descrição</Th></tr></thead>
            <tbody>
              <tr><Td>Mensalidade PlaceFit</Td><Td>R$ 180,00</Td><Td>Acesso base (obrigatório)</Td></tr>
              <tr><Td>Catálogo WhatsApp</Td><Td>R$ 59,90</Td><Td>Publicação no WhatsApp Business</Td></tr>
              <tr><Td>Conta de Vendedores</Td><Td>R$ 100,00</Td><Td>Sub-contas para vendedores</Td></tr>
              <tr><Td>Compras Internacionais</Td><Td>R$ 120,00</Td><Td>Importação da China com escrow</Td></tr>
            </tbody>
          </table>
          <div>
            {["10% desconto no anual", "12x no cartão", "PIX", "Boleto", "Cartão recorrente"].map((p) => (
              <span key={p} style={styles.pill}>{p}</span>
            ))}
          </div>
          <h3 style={styles.h3}>Potencial de Monetização Futura</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Take rate sobre transações do e-commerce</li>
            <li style={styles.li}>Comissão sobre pedidos de compra fabricante → revendedor</li>
            <li style={styles.li}>Premium para fabricantes (destaque, analytics)</li>
            <li style={styles.li}>API access para integradores</li>
            <li style={styles.li}>White-label para grandes redes</li>
          </ul>
        </div>

        {/* 5. ARQUITETURA */}
        <div style={styles.section}>
          <h2 style={styles.h2}>5. Arquitetura Técnica</h2>
          <h3 style={styles.h3}>Stack</h3>
          <table style={styles.table}>
            <thead><tr><Th>Camada</Th><Th>Tecnologia</Th></tr></thead>
            <tbody>
              {[["Frontend", "React 18 + Vite + Tailwind CSS + shadcn/ui"], ["Backend", "Base44 (BaaS) — serverless functions em Deno/TypeScript"], ["Banco de Dados", "MongoDB (via Base44 entities)"], ["Autenticação", "Google OAuth + Base44 Auth"], ["Pagamentos", "Stripe (cartão, PIX, boleto)"], ["Realtime", "WebSockets (Base44 subscriptions)"], ["PWA", "Instalável (manifest, service worker)"], ["Hospedagem", "Base44 Cloud"], ["Mobile", "Publica para iOS/Android do mesmo código"]].map(([c, t]) => (
                <tr key={c}><Td><strong>{c}</strong></Td><Td>{t}</Td></tr>
              ))}
            </tbody>
          </table>
          <h3 style={styles.h3}>Entidades de Dados</h3>
          <p style={styles.p}><strong>35+ entidades</strong> incluindo: ProductTemplate, SupplierProduct, Fabricante, FabricanteChina, Pedido, PedidoVenda, PedidoCompra, PedidoChina, LojaConfig, LojaCliente, LojaPedido, PlanoServico, AssinaturaUsuario, FaturaAssinatura, MetodoPagamento, TabelaFrete, FreightOffer, CRMConversa, CRMMensagem, AIKnowledge, IAConfig, Cliente, Notification, AppVersion e mais.</p>
          <h3 style={styles.h3}>Backend Functions</h3>
          <p style={styles.p}><strong>45+ funções serverless</strong> cobrindo: catálogo, e-commerce, feeds de marketplace (Google, Meta, ML), pagamentos Stripe, assinaturas, CRM/WhatsApp, IA e admin.</p>
          <h3 style={styles.h3}>Segurança (RLS)</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Revendedores só veem seus próprios dados</li>
            <li style={styles.li}>Fabricantes só veem seus produtos e pedidos</li>
            <li style={styles.li}>Clientes da loja só veem seus pedidos</li>
            <li style={styles.li}>Cartões e faturas só visíveis para o dono ou admin</li>
          </ul>
        </div>

        {/* 6. INTEGRAÇÕES */}
        <div style={styles.section}>
          <h2 style={styles.h2}>6. Integrações Externas</h2>
          <table style={styles.table}>
            <thead><tr><Th>Integração</Th><Th>Função</Th></tr></thead>
            <tbody>
              {[["Stripe", "Cobrança recorrente, cartão, PIX, boleto, webhook"], ["Google Shopping", "Feed automático, Merchant Center, domínio próprio"], ["Meta Commerce", "Catálogo WhatsApp Business, push instantâneo"], ["Mercado Livre", "OAuth, mapeamento de categorias, exportação de anúncios"], ["WhatsApp (CRM)", "Conversas, templates, webhook, atendente IA"], ["IA (LLM)", "Atendente de IA, base de conhecimento, respostas contextuais"]].map(([i, f]) => (
                <tr key={i}><Td><strong>{i}</strong></Td><Td>{f}</Td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 7. JORNADAS */}
        <div style={styles.section}>
          <h2 style={styles.h2}>7. Jornadas Principais</h2>
          <h3 style={styles.h3}>Jornada do Revendedor (Core Loop)</h3>
          <pre style={styles.pre}>{`Cadastro → Ativação automática → Tour guiado
  ↓
Explora Catálogo Geral (2.490 produtos, compara preços)
  ↓
Adiciona produtos à "Meus Produtos" (define margem)
  ↓
Gera "Sua Tabela" (PDF com marca + margem)
  ↓
Cria Orçamento → Converte em Venda
  ↓
Gera Pedido de Compra para fabricante
  ↓
[Opcional] Cria Loja Online → Recebe pedidos
  ↓
[Opcional] Publica no Google Shopping / WhatsApp / ML
  ↓
[Opcional] Contrata Atendente IA`}</pre>

          <h3 style={styles.h3}>Jornada do Fabricante</h3>
          <pre style={styles.pre}>{`Cadastro → Aprovação do admin
  ↓
Sobe tabela de preços (CSV/Excel) → Mapeamento automático
  ↓
Define acordo comercial (comissão, markup)
  ↓
Recebe pedidos de compra dos revendedores
  ↓
[Opcional] Publica catálogo no WhatsApp Business`}</pre>

          <h3 style={styles.h3}>Jornada do Cliente Final</h3>
          <pre style={styles.pre}>{`Acessa loja (ex: /loja/muscularfit)
  ↓
Navega catálogo → Adiciona ao carrinho
  ↓
Cadastro/Login → Calcula frete → Escolhe pagamento
  ↓
Finaliza pedido → Cai no painel do revendedor
  ↓
Revendedor confirma → Gera pedido de compra → Organiza entrega`}</pre>
        </div>

        {/* 8. STATUS */}
        <div style={styles.section}>
          <h2 style={styles.h2}>8. O que está pronto vs. em desenvolvimento</h2>
          <h3 style={styles.h3}><span style={{ ...styles.badge, ...styles.badgeGreen }}>✅ Pronto e em Produção</span></h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Catálogo centralizado: 2.490 templates, 4.225 preços vinculados</li>
            <li style={styles.li}>16 fabricantes cadastrados (13 aprovados)</li>
            <li style={styles.li}>35 usuários ativos, 17 assinantes pagantes</li>
            <li style={styles.li}>E-commerce: 3 lojas ativas, 10 pedidos processados</li>
            <li style={styles.li}>Cobrança recorrente via Stripe (cartão, PIX, boleto)</li>
            <li style={styles.li}>CRM de WhatsApp com atendente de IA</li>
            <li style={styles.li}>Feed Google Shopping + Meta Commerce + Mercado Livre</li>
            <li style={styles.li}>Importação da China (9 fabricantes, escrow, documentos)</li>
            <li style={styles.li}>Tabela de frete (20 estados)</li>
            <li style={styles.li}>PWA instalável</li>
            <li style={styles.li}>Onboarding guiado</li>
          </ul>
          <h3 style={styles.h3}><span style={{ ...styles.badge, ...styles.badgeAmber }}>🔄 Em Evolução / Próximos Passos</span></h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Aumentar base de revendedores (atualmente 14)</li>
            <li style={styles.li}>Ativar contratações de recursos avulsos (CW, CV, CI)</li>
            <li style={styles.li}>Expandir pedidos no e-commerce</li>
            <li style={styles.li}>Take rate sobre transações</li>
            <li style={styles.li}>Analytics e dashboard de insights</li>
            <li style={styles.li}>App mobile nativo (iOS/Android)</li>
            <li style={styles.li}>API pública para integradores</li>
          </ul>
        </div>

        {/* 9. OPORTUNIDADE */}
        <div style={styles.section}>
          <h2 style={styles.h2}>9. Oportunidade de Mercado</h2>
          <h3 style={styles.h3}>Tamanho do Mercado</h3>
          <p style={styles.p}>O mercado fitness brasileiro movimenta <strong>R$ 10+ bilhões/ano</strong> em equipamentos, com milhares de revendedores e centenas de fabricantes. Mercado fragmentado, com pouca digitalização e dependência de catálogos em PDF, planilhas e WhatsApp manual.</p>
          <h3 style={styles.h3}>Problema Resolvido</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Revendedores sem visibilidade de preços entre fabricantes, dependentes de distribuidores</li>
            <li style={styles.li}>Fabricantes sem canal direto com revendedores, perdendo margem para intermediários</li>
            <li style={styles.li}>Processo manual de cotação, tabela, orçamentos e pedidos — lento e propenso a erro</li>
            <li style={styles.li}>E-commerce caro e complexo para pequenos revendedores</li>
            <li style={styles.li}>Integração com marketplaces (Google, WhatsApp, ML) inacessível</li>
          </ul>
          <h3 style={styles.h3}>Projeção de Receita (Conservadora)</h3>
          <table style={styles.table}>
            <thead><tr><Th>Milestone</Th><Th>Revendedores</Th><Th>MRR</Th><Th>ARR</Th></tr></thead>
            <tbody>
              {[["Atual", 14, "R$ 3.060", "R$ 36.720"], ["+6 meses", 50, "R$ 9.000+", "R$ 108.000+"], ["+12 meses", 150, "R$ 27.000+", "R$ 324.000+"], ["+24 meses", 500, "R$ 90.000+", "R$ 1.080.000+"]].map(([m, r, mrr, arr]) => (
                <tr key={m}><Td><strong>{m}</strong></Td><Td>{r}</Td><Td>{mrr}</Td><Td>{arr}</Td></tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...styles.p, fontSize: "0.85rem", color: "#94a3b8" }}>*Projeção considera apenas mensalidade base. Recursos avulsos e take rate são adicionais.</p>
        </div>

        {/* 10. IDENTIDADE */}
        <div style={styles.section}>
          <h2 style={styles.h2}>10. Identidade Visual</h2>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Nome:</strong> PlaceFit</li>
            <li style={styles.li}><strong>Tagline:</strong> "Da cotação à entrega. Toda a sua operação fitness em um só lugar."</li>
            <li style={styles.li}><strong>Posicionamento:</strong> "Sem atravessador!"</li>
            <li style={styles.li}><strong>Paleta:</strong> Azul (#1e40af) + Verde industrial (#059669) + Branco/Grafite</li>
            <li style={styles.li}><strong>Estilo:</strong> Industrial minimalista, profissional, limpo</li>
          </ul>
        </div>

        {/* 11. CONTATO */}
        <div style={styles.section}>
          <h2 style={styles.h2}>11. Investimento Buscado</h2>
          <p style={styles.p}>A PlaceFit está pronta para escalar. O produto está em produção, o modelo de cobrança está validado e as integrações críticas (Stripe, Google, Meta, Mercado Livre) estão operacionais.</p>
          <h3 style={styles.h3}>Uso do Investimento</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Aquisição de revendedores (marketing e vendas)</li>
            <li style={styles.li}>Expansão da base de fabricantes</li>
            <li style={styles.li}>Desenvolvimento de features de retenção (analytics, app mobile)</li>
            <li style={styles.li}>Time de sucesso do cliente e suporte</li>
          </ul>
          <hr style={styles.hr} />
          <p style={styles.footer}>Documento gerado em setembro de 2026 com dados em tempo real da plataforma.<br />PlaceFit — placefit.base44.app</p>
        </div>
      </div>
    </div>
  );
}