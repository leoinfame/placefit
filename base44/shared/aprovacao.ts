// Aprovacao de contas: o servidor so considera "fabricante/transportador aprovado" quem tem
// registro em AprovacaoUsuario (gravado apenas por admin). User.aprovado/tipo_usuario sao
// editaveis pelo proprio usuario, entao nao bastam.

export type Tipo = 'fabricante' | 'transportador' | 'revendedor' | 'admin';

export const tipoDoUsuario = (u: any): Tipo =>
  u?.role === 'admin' ? 'admin' : (u?.tipo_usuario === 'fabricante' || u?.tipo_usuario === 'transportador' ? u.tipo_usuario : 'revendedor');

// Ultimo registro por user_id.
export async function mapaAprovacoes(sr: any): Promise<Map<string, any>> {
  const linhas = await sr.entities.AprovacaoUsuario.list('-updated_date', 5000);
  const m = new Map<string, any>();
  for (const r of linhas) if (r?.user_id && !m.has(r.user_id)) m.set(r.user_id, r);
  return m;
}

// Aprovado pelo admin COMO esse tipo, e o cadastro atual continua desse tipo e aprovado.
export function aprovadoComo(mapa: Map<string, any>, u: any, tipo: Tipo): boolean {
  const r = mapa.get(u?.id);
  return !!r && r.aprovado === true && r.tipo_usuario === tipo && u?.aprovado === true && tipoDoUsuario(u) === tipo;
}

// Grava (ou atualiza) o registro a partir do estado atual do User. So chamar em contexto de admin.
export async function registrarAprovacao(sr: any, u: any, por: string) {
  const dados = { user_id: u.id, tipo_usuario: tipoDoUsuario(u), aprovado: u.aprovado === true, por, em: new Date().toISOString() };
  const existentes = await sr.entities.AprovacaoUsuario.filter({ user_id: u.id }, '-updated_date', 1);
  if (existentes[0]) return sr.entities.AprovacaoUsuario.update(existentes[0].id, dados);
  return sr.entities.AprovacaoUsuario.create(dados);
}
