import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reuses callback-owned forms without changing their payload or save authority.
 * @template T
 * @param {T} initialValue
 * @param {string} identity
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
export default function useCadastroRecordState(initialValue, identity) {
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [state, setState] = useState({ identity, value: initialValue });
  useEffect(() => {
    setState(previous => previous.identity === identity ? previous : { identity, value: initialValue });
  }, [identity, initialValue]);
  const setValue = useCallback((/** @type {import('react').SetStateAction<T>} */ next) => {
    if (currentIdentity.current !== identity) return;
    setState(previous => {
      const value = previous.identity === identity ? previous.value : initialValue;
      return { identity, value: next instanceof Function ? next(value) : next };
    });
  }, [identity, initialValue]);
  return [state.identity === identity ? state.value : initialValue, setValue];
}
