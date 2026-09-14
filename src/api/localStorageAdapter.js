/**
 * Storage local tolerante para leitura geral e estrito para fluxos que exigem confirmacao.
 * @returns {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 *   setItemStrict: (key: string, value: string) => void,
 *   removeItem: (key: string) => void,
 * }}
 */
export const createLocalStorageAdapter = () => ({
  getItem(key) {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('[base44-local] Nao foi possivel gravar localStorage:', key, error instanceof Error ? error.message : error);
    }
  },
  setItemStrict(key, value) {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Armazenamento local indisponivel.');
    }
    window.localStorage.setItem(key, value);
    if (window.localStorage.getItem(key) !== value) {
      throw new Error('A escrita no armazenamento local nao foi confirmada.');
    }
  },
  removeItem(key) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  },
});
