// Banco em memoria imitando base44.entities (filter/create/update/list) para testar hubApi de ponta a ponta.
export const DB: Record<string, any[]> = {};
let seq = 0;
const col = (nome: string) => (DB[nome] ||= []);
function entidade(nome: string) {
  return {
    async filter(q: Record<string, any> = {}, sort?: string, limit = 50) {
      let r = col(nome).filter((x) => Object.entries(q).every(([k, v]) =>
        v && typeof v === 'object' && Array.isArray((v as any).$in) ? (v as any).$in.includes(x[k]) : x[k] === v));
      if (sort) {
        const desc = sort.startsWith('-'); const k = sort.replace('-', '');
        r = [...r].sort((a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? '')) * (desc ? -1 : 1));
      }
      return structuredClone(r.slice(0, limit));
    },
    async list(sort?: string, limit = 50) { return this.filter({}, sort, limit); },
    async create(d: any) {
      const t = new Date(Date.now() + seq).toISOString();
      const rec = { id: `${nome}-${++seq}`, created_date: t, updated_date: t, ...structuredClone(d) };
      col(nome).push(rec); return structuredClone(rec);
    },
    async update(id: string, d: any) {
      const rec = col(nome).find((x) => x.id === id); if (!rec) throw new Error('nao existe ' + id);
      Object.assign(rec, structuredClone(d), { updated_date: new Date(Date.now() + ++seq).toISOString() }); return structuredClone(rec);
    },
  };
}
const entities = new Proxy({}, { get: (_t, nome: string) => entidade(nome) });
export const USERS: Record<string, any> = {};
export function createClientFromRequest(req: Request) {
  const uid = req.headers.get('x-user');
  return { auth: { me: async () => (uid ? USERS[uid] : null) }, asServiceRole: { entities } };
}
