import assert from 'node:assert/strict';

/**
 * Pacote A — remainder autorizado: limpa lastGoodData/everLoaded na troca de escopo
 * (erro/vazio do novo tenant ≠ cache do anterior). Restaura pin e36231b3 do Visualizador V24.
 */
export function scopeListCacheRemainder(source) {
  const before = `  // Troca de empresa/grupo: fecha form, limpa seleção/cache de lista e invalida carga em voo.
  // lastGoodData zerado: erro/vazio do novo escopo não reutiliza linhas do tenant anterior.
  useEffect(function() {
    if (previousScopeRef.current === scopeKey) return;
    previousScopeRef.current = scopeKey;
    formScopeRef.current = null;
    lastGoodData.current = [];
    everLoadedRef.current = false;
    const reset = buildCadastroScopeSwitchReset({ formKey: 0 });
`;
  const after = `  // Troca de empresa/grupo: fecha form, limpa seleção e invalida carga em voo (fail-closed multiempresa).
  useEffect(function() {
    if (previousScopeRef.current === scopeKey) return;
    previousScopeRef.current = scopeKey;
    formScopeRef.current = null;
    const reset = buildCadastroScopeSwitchReset({ formKey: 0 });
`;
  let result = source.replace(/\r\n/g, '\n');
  assert.equal(result.split(before).length, 2, 'scope list-cache hunk must occur exactly once');
  return result.replace(before, after);
}
