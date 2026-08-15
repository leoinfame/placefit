// Autenticacao de clientes da vitrine publica (LojaCliente).
// Senha com hash SHA-256 + salt; token de sessao gerado no login.

const SALT = '__placefit_loja__';

export async function hashPassword(pw: string): Promise<string> {
  const enc = new TextEncoder().encode(String(pw) + SALT);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function genToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function publicCliente(c: any) {
  if (!c) return null;
  return {
    id: c.id, nome: c.nome, email: c.email, cpf: c.cpf, telefone: c.telefone,
    cep: c.cep, endereco: c.endereco, numero: c.numero, complemento: c.complemento,
    bairro: c.bairro, cidade: c.cidade, estado: c.estado,
  };
}