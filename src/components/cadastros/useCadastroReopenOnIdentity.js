import { useEffect, useRef } from "react";
import {
  CADASTRO_DIRTY_REOPEN_CONFIRM,
  CADASTRO_DIRTY_SWITCH_CONFIRM,
  cadastroFormMatchesIncoming,
  cadastroFormSnapshot,
  decideCadastroReopen,
  isCadastroFormDirty,
} from "./cadastroReopenPolicy";

/**
 * Reidrata formData quando id/updated_date mudam, protegendo rascunho sujo.
 * @param {object|null|undefined} record registro atual (props)
 * @param {object} opts
 * @param {object} opts.formData estado local
 * @param {(next: object) => void} opts.setFormData
 * @param {(record: object) => object} opts.mapToForm mapeia record → shape do form
 * @param {object} [opts.emptyForm] usado ao limpar (record ausente)
 * @param {() => boolean} [opts.confirmDiscard]
 * @param {() => boolean} [opts.confirmSwitch]
 */
export default function useCadastroReopenOnIdentity(record, {
  formData,
  setFormData,
  mapToForm,
  emptyForm = {},
  clearOnNull = true,
  confirmDiscard = () => window.confirm(CADASTRO_DIRTY_REOPEN_CONFIRM),
  confirmSwitch = () => window.confirm(CADASTRO_DIRTY_SWITCH_CONFIRM),
}) {
  const prevIdRef = useRef(record?.id || null);
  const prevUpdatedRef = useRef(record?.updated_date);
  const baselineRef = useRef(cadastroFormSnapshot(formData));
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  useEffect(() => {
    const nextId = record?.id || null;
    const idChanged = nextId !== prevIdRef.current;
    const updatedChanged = Boolean(
      nextId && record?.updated_date && record.updated_date !== prevUpdatedRef.current,
    );

    if (!nextId) {
      if (prevIdRef.current !== null) {
        prevIdRef.current = null;
        prevUpdatedRef.current = undefined;
        if (clearOnNull) {
          baselineRef.current = cadastroFormSnapshot(emptyForm);
          setFormData(emptyForm);
        }
      }
      return;
    }

    const next = mapToForm(record);
    const decision = decideCadastroReopen({
      idChanged,
      updatedChanged,
      isDirty: isCadastroFormDirty(formDataRef.current, baselineRef.current),
      matchesIncoming: cadastroFormMatchesIncoming(formDataRef.current, next),
      confirmDiscard,
      confirmSwitch,
    });

    if (decision === "acknowledge") {
      // Sinalização já ocorreu via confirm; reconhece versão sem wipe do rascunho.
      // Em troca de id recusada, não avança prevId — mantém âncora do rascunho.
      if (updatedChanged && !idChanged) {
        prevUpdatedRef.current = record.updated_date;
      }
      return;
    }

    if (decision === "apply") {
      prevIdRef.current = nextId;
      prevUpdatedRef.current = record.updated_date;
      baselineRef.current = cadastroFormSnapshot(next);
      setFormData(next);
    }
  }, [record?.id, record?.updated_date]); // eslint-disable-line react-hooks/exhaustive-deps — identidade canônica
}
