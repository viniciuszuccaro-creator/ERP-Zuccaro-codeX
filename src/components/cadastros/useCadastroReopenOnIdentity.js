import { useEffect, useRef, useState } from "react";
import {
  CADASTRO_DIRTY_REOPEN_CONFIRM,
  CADASTRO_DIRTY_SWITCH_CONFIRM,
  cadastroFormMatchesIncoming,
  cadastroFormSnapshot,
  decideCadastroReopen,
  isCadastroFormDirty,
} from "./cadastroReopenPolicy";

/**
 * Reidrata por ID e versao HTTP updated_at ou alias legado updated_date, protegendo rascunho.
 * @param {object|null|undefined} record registro atual (props)
 * @param {object} opts
 * @param {object} opts.formData estado local
 * @param {(next: object) => void} opts.setFormData
 * @param {(record: object) => object} opts.mapToForm mapeia record → shape do form
 * @param {object} [opts.emptyForm] usado ao limpar (record ausente)
 * @param {boolean} [opts.clearOnNull=true] limpa form quando record fica ausente
 * @param {string|null} [opts.tenantKey=null] identidade de Grupo/Empresa/escopo; quando muda,
 *   invalida rascunho (equivalente ao identity do RecordState). Opt-in — omitir = sem efeito.
 * @param {() => boolean} [opts.confirmDiscard]
 * @param {() => boolean} [opts.confirmSwitch]
 * @param {(boundId: string|null) => void} [opts.onRejectSwitch] pai deve realinhar seleção ao rascunho
 * @returns {{ boundId: string|null, identityMismatch: boolean }}
 */
export default function useCadastroReopenOnIdentity(record, {
  formData,
  setFormData,
  mapToForm,
  emptyForm = {},
  clearOnNull = true,
  tenantKey = null,
  confirmDiscard = () => window.confirm(CADASTRO_DIRTY_REOPEN_CONFIRM),
  confirmSwitch = () => window.confirm(CADASTRO_DIRTY_SWITCH_CONFIRM),
  onRejectSwitch,
}) {
  // HTTP owns updated_at; retain the legacy alias without changing draft/identity decisions.
  const recordVersion = record?.updated_at ?? record?.updated_date;
  const prevIdRef = useRef(record?.id || null);
  const prevUpdatedRef = useRef(recordVersion);
  const prevTenantRef = useRef(tenantKey);
  const baselineRef = useRef(cadastroFormSnapshot(formData));
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const emptyFormRef = useRef(emptyForm);
  emptyFormRef.current = emptyForm;
  const mapToFormRef = useRef(mapToForm);
  mapToFormRef.current = mapToForm;
  const onRejectSwitchRef = useRef(onRejectSwitch);
  onRejectSwitchRef.current = onRejectSwitch;

  const [boundId, setBoundId] = useState(() => record?.id || null);
  const propId = record?.id || null;
  const identityMismatch = Boolean(boundId && propId && String(boundId) !== String(propId));

  // Preserva invalidação de tenant do RecordState: rascunho de A não migra para B.
  useEffect(() => {
    if (tenantKey == null) return;
    if (prevTenantRef.current === tenantKey) return;
    prevTenantRef.current = tenantKey;

    const nextId = record?.id || null;
    if (!nextId) {
      prevIdRef.current = null;
      prevUpdatedRef.current = undefined;
      setBoundId(null);
      const next = emptyFormRef.current;
      baselineRef.current = cadastroFormSnapshot(next);
      setFormData(next);
      return;
    }

    const next = mapToFormRef.current(record);
    prevIdRef.current = nextId;
    prevUpdatedRef.current = record?.updated_at ?? record?.updated_date;
    setBoundId(nextId);
    baselineRef.current = cadastroFormSnapshot(next);
    setFormData(next);
  }, [tenantKey, record, setFormData]);

  useEffect(() => {
    const nextId = record?.id || null;
    const idChanged = nextId !== prevIdRef.current;
    const updatedChanged = Boolean(
      nextId && recordVersion && recordVersion !== prevUpdatedRef.current,
    );

    if (!nextId) {
      if (prevIdRef.current !== null) {
        prevIdRef.current = null;
        prevUpdatedRef.current = undefined;
        setBoundId(null);
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
        prevUpdatedRef.current = recordVersion;
      }
      if (idChanged) {
        // Pai continua com props do outro registro; notifica para realinhar seleção.
        onRejectSwitchRef.current?.(prevIdRef.current);
      }
      return;
    }

    if (decision === "apply") {
      prevIdRef.current = nextId;
      prevUpdatedRef.current = recordVersion;
      setBoundId(nextId);
      baselineRef.current = cadastroFormSnapshot(next);
      setFormData(next);
    }
  }, [record?.id, recordVersion]);

  return { boundId, identityMismatch };
}
