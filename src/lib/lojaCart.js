// Carrinho da vitrine publica, persistido por slug no localStorage.
// Compartilhado entre a vitrine (LojaPublica) e a pagina de produto (LojaProduto).

const key = (slug) => `loja_carrinho_${slug}`;

export const getStoredCart = (slug) => {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};

export const setStoredCart = (slug, cart) => {
  try {
    localStorage.setItem(key(slug), JSON.stringify(cart));
  } catch (e) {}
};

export const clearStoredCart = (slug) => {
  try {
    localStorage.removeItem(key(slug));
  } catch (e) {}
};