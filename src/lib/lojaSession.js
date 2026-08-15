// Sessao do cliente da vitrine publica (LojaCliente). Persistida por slug.

export const getSession = (slug) => {
  try {
    const raw = localStorage.getItem(`loja_sessao_${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
};

export const setSession = (slug, cliente, token) => {
  localStorage.setItem(`loja_sessao_${slug}`, JSON.stringify({ cliente, token }));
};

export const clearSession = (slug) => {
  localStorage.removeItem(`loja_sessao_${slug}`);
};