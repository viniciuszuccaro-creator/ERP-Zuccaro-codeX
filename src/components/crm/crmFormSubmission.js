/** Submission lock for the existing CRM form; no persistence or automatic retry. */
export function createCrmFormSubmissionGate() {
  let pending = null;
  return {
    run({ payload, submit, assertCurrent, onPending = () => {} }) {
      if (pending) return pending;
      if (typeof submit !== 'function') return Promise.reject(new Error('Gravação indisponível.'));
      // Freeze all fields, including legacy extensions, before an asynchronous write.
      const snapshot = structuredClone(payload);
      onPending(true);
      pending = Promise.resolve().then(async () => {
        assertCurrent();
        const result = await submit(snapshot);
        try { assertCurrent(); }
        catch { throw new Error('Contexto alterado durante a gravação. Ela pode ter sido concluída; consulte o registro antes de tentar novamente.'); }
        return result;
      }).finally(() => { pending = null; onPending(false); });
      return pending;
    },
  };
}
