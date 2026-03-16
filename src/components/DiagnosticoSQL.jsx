// COPIE E EXECUTE ESTES COMANDOS SQL NO SEU BANCO
// Para diagnosticar por que PedidoCompra não está persistindo

const DIAGNOSTICO_SQL = `
-- ========== 1. VERIFICAR NOME EXATO DA TABELA ==========
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name ILIKE '%pedido%compra%' OR table_name ILIKE '%purchase%');

-- ========== 2. VERIFICAR TODAS AS COLUNAS ==========
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name ILIKE 'pedido%compra%' OR table_name ILIKE '%purchase%order%'
ORDER BY table_name, ordinal_position;

-- ========== 3. VERIFICAR RLS POLICIES ==========
SELECT * FROM pg_policies 
WHERE tablename ILIKE '%pedido%compra%' OR tablename ILIKE '%purchase%';

-- ========== 4. HABILITAR RLS PARA TESTE ==========
-- Executar APENAS se as políticas não permitirem INSERT
ALTER TABLE "PedidoCompra" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_insert_authenticated" ON "PedidoCompra"
FOR INSERT WITH CHECK (true);

-- ========== 5. VERIFICAR CONSTRAINTS ==========
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name ILIKE '%pedido%compra%'
ORDER BY tc.table_name, tc.constraint_name;

-- ========== 6. VERIFICAR CHAVES ESTRANGEIRAS ==========
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE (tc.table_name ILIKE '%pedido%compra%' OR tc.table_name ILIKE '%purchase%')
  AND tc.constraint_type = 'FOREIGN KEY';
`;

export const DiagnosticInfo = () => (
  <div style={{ 
    backgroundColor: '#f9fafb', 
    padding: '20px', 
    borderRadius: '8px', 
    border: '2px solid #ff9800',
    marginTop: '20px',
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '600px',
    overflow: 'auto'
  }}>
    <h3>🔧 DIAGNÓSTICO SQL - Copie e execute no seu banco</h3>
    <pre style={{ 
      backgroundColor: '#1e1e1e', 
      color: '#00ff00',
      padding: '15px',
      borderRadius: '4px',
      overflow: 'auto'
    }}>
      {DIAGNOSTICO_SQL}
    </pre>
    <p style={{ marginTop: '15px', color: '#d32f2f' }}>
      ⚠️ Procure por erros como:
      <ul>
        <li>❌ Tabela não encontrada → nome diferente?</li>
        <li>❌ RLS 403 error → falta permissão</li>
        <li>❌ Column does not exist → nome coluna diferente</li>
        <li>❌ Foreign key violation → IDs inválidos</li>
      </ul>
    </p>
  </div>
);

export default DiagnosticInfo;