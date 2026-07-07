// Expands templates with short field names back to long field names
const FIELD_MAP = {
  i: 'id', n: 'nome', c: 'cod', ca: 'categoria', sc: 'subcategoria',
  ta: 'tipo_anilha', tf: 'tipo_furo', ac: 'acabamento',
  bt: 'barra_tipo', ba: 'barra_acabamento', bf: 'bojo_formato', dt: 'dumbell_tipo',
  pe: 'piso_espessura_mm', pf: 'piso_formato', tt: 'tijolinho_tipo', tl: 'tijolinho_torre',
  sm: 'suporte_modelo', se: 'suporte_estrutura', sd: 'suporte_degraus',
  scp: 'suporte_capacidade_pares', scu: 'suporte_capacidade_unidades',
  stc: 'suporte_torre_capacidade', stt: 'suporte_torre_tipo',
  pg: 'pegada', pfa: 'peso_faixa', pk: 'peso_kg', u: 'und', f: 'foto', at: 'ativo'
};

export function expandTemplates(templates, fieldMap) {
  const map = fieldMap || FIELD_MAP;
  return (templates || []).map(t => {
    const expanded = {};
    for (const [short, long] of Object.entries(map)) {
      if (t[short] !== undefined) expanded[long] = t[short];
    }
    return expanded;
  });
}