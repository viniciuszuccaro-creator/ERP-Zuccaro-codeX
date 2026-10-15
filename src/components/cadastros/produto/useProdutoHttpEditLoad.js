import { useEffect, useState } from 'react';
import { isProdutoHttpEditLoadComplete } from './produtoHttpPolicy.js';

/** GET canônico obrigatório antes de editar; respostas de outra sessão não alteram o rascunho. */
export default function useProdutoHttpEditLoad({ enabled, produtoId, scopeKey, isScopeCurrent, load, onLoaded, onError }) {
  const [readyId, setReadyId] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !produtoId) return;
    setReadyId(null);
    setLoadError(false);
    if (!isScopeCurrent()) return;
    let active = true;
    Promise.resolve().then(() => load(produtoId)).then((row) => {
      if (!isProdutoHttpEditLoadComplete(row, produtoId)) throw new Error('Resposta sem produto completo correspondente');
      if (!active || !isScopeCurrent()) return;
      onLoaded(row);
      setReadyId(produtoId);
    }).catch((error) => {
      if (!active || !isScopeCurrent()) return;
      setLoadError(true);
      onError(error);
    });
    return () => { active = false; };
  }, [enabled, produtoId, scopeKey, attempt]);

  return { readyId, loadError, retry: () => setAttempt((value) => value + 1) };
}
