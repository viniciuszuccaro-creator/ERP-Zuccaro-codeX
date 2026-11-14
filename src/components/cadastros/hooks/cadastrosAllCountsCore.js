/**
 * Núcleo puro das contagens Cadastros Gerais (Pacote A).
 * Sem React/JSX — reutiliza buildContextFilter canônico (cadastroCountFilter).
 */
import { buildContextFilter } from '../../lib/cadastroCountFilter.js';

export const BLOCOS_ENTITIES = {
  bloco1: ["Cliente","Fornecedor","Transportadora","Colaborador","Representante","ContatoB2B","SegmentoCliente","RegiaoAtendimento"],
  bloco2: ["Produto","Servico","SetorAtividade","GrupoProduto","Marca","TabelaPreco","KitProduto","CatalogoWeb","UnidadeMedida"],
  bloco3: ["Banco","FormaPagamento","PlanoDeContas","CentroCusto","CentroResultado","TipoDespesa","MoedaIndice","OperadorCaixa","ConfiguracaoDespesaRecorrente","TabelaFiscal","CondicaoComercial"],
  bloco4: ["Veiculo","Motorista","TipoFrete","LocalEstoque","RotaPadrao","ModeloDocumento"],
  bloco5: ["Empresa","GrupoEmpresarial","Departamento","Cargo","Turno","PerfilAcesso"],
  bloco6: ["ApiExterna","ChatbotCanal","ChatbotIntent","JobAgendado","Webhook","ConfiguracaoNFe","GatewayPagamento","EventoNotificacao"],
};

export const ALL_ENTITIES = Object.values(BLOCOS_ENTITIES).flat();

/** Alias estável — mesma função canônica do useEntityCounts. */
export function buildCadastrosAllCountsFilter(entityName, empresaId, groupId, empresasDoGrupo) {
  return buildContextFilter(entityName, empresaId, groupId, empresasDoGrupo) ?? {};
}

/** @param {string[]} [entities] @returns {Record<string, number>} */
export function emptyCadastrosCounts(entities = ALL_ENTITIES) {
  /** @type {Record<string, number>} */
  const vazio = {};
  entities.forEach((e) => { vazio[e] = 0; });
  return vazio;
}

/**
 * Exige todas as entidades pedidas. Chave ausente = parcial ≠ total confirmado.
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {string[]} [entities]
 * @returns {Record<string, number>}
 * @throws {Error & { code?: string, missing?: string[] }}
 */
/**
 * Contagem válida: number finito, safe integer, ≥ 0.
 * null/false/''/-1/1.5/overflow → indisponível (parcial), nunca coerção a 0.
 * @param {unknown} value
 * @returns {value is number}
 */
export function isValidCountValue(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

export function normalizeCadastrosCounts(raw, entities = ALL_ENTITIES) {
  /** @type {Record<string, number>} */
  const full = {};
  const missing = [];
  for (const e of entities) {
    if (!Object.prototype.hasOwnProperty.call(raw || {}, e)) {
      missing.push(e);
      continue;
    }
    const v = /** @type {Record<string, unknown>} */ (raw || {})[e];
    if (!isValidCountValue(v)) {
      missing.push(e);
      continue;
    }
    full[e] = v;
  }
  if (missing.length) {
    /** @type {Error & { code?: string, missing?: string[], partialCounts?: Record<string, number> }} */
    const err = new Error('READ_COUNT_PARTIAL');
    err.code = 'READ_COUNT_PARTIAL';
    err.missing = missing;
    // Contagens válidas isoladas — consumidor pode exibir o que respondeu sem inventar 0 no restante.
    err.partialCounts = full;
    throw err;
  }
  return full;
}

/**
 * Conta em lote. Falha/parcial propaga (erro ≠ vazio; parcial ≠ total).
 * @param {object} [options]
 * @param {(name: string, body?: object) => Promise<{ data?: any }>} [options.invoke]
 * @param {string|null} [options.empresaId]
 * @param {string|null} [options.groupId]
 * @param {Array<{ id?: string }>} [options.empresasDoGrupo]
 * @param {string[]} [options.entities]
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchCadastrosAllCounts({
  invoke,
  empresaId,
  groupId,
  empresasDoGrupo,
  entities = ALL_ENTITIES,
} = {}) {
  if (typeof invoke !== 'function') {
    throw new Error('invoke obrigatório');
  }
  if (!empresaId && !groupId) {
    // Sem contexto: indisponível — NUNCA fabricar mapa de zeros como total confirmado.
    throw new Error('READ_COUNT_UNAVAILABLE');
  }

  const batch = entities.map((entityName) => ({
    entityName,
    filter: buildCadastrosAllCountsFilter(entityName, empresaId, groupId, empresasDoGrupo),
  }));

  /** @type {Record<string, unknown>} */
  const result = {};
  /** @type {string[]|null} */
  let missingAfterAggregate = null;

  try {
    const res = await invoke('countEntities', { entities: batch });
    const raw = /** @type {Record<string, unknown>} */ (res?.data?.counts || res?.data || {});
    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
      try {
        return normalizeCadastrosCounts(raw, entities);
      } catch (partialError) {
        const partial = /** @type {{ code?: string, message?: string, partialCounts?: Record<string, number>, missing?: string[] }} */ (partialError);
        if (partial?.code === 'READ_COUNT_PARTIAL' || partial?.message === 'READ_COUNT_PARTIAL') {
          // Preserva o que já respondeu; tenta preencher só o que faltou (ex.: SetorAtividade 500).
          Object.assign(result, partial.partialCounts || {});
          missingAfterAggregate = Array.isArray(partial.missing) ? partial.missing : null;
        } else {
          throw partialError;
        }
      }
    }
  } catch (error) {
    const maybePartial = /** @type {{ code?: string, message?: string }|null|undefined} */ (error);
    if (maybePartial?.code === 'READ_COUNT_PARTIAL' || maybePartial?.message === 'READ_COUNT_PARTIAL') {
      throw error;
    }
    if (typeof console !== 'undefined') {
      console.warn('[cadastrosAllCountsCore] Contagem agregada indisponivel', error);
    }
  }

  const pending = missingAfterAggregate
    ? batch.filter((row) => missingAfterAggregate.includes(row.entityName))
    : batch;

  /** Auxiliar 500/negativa não envenena o lote: tenta fatia, depois entidade a entidade. */
  const BATCH = 8;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    if (i > 0) await new Promise((r) => setTimeout(r, 0));
    let sliceComplete = false;
    try {
      const res = await invoke('countEntities', { entities: slice });
      const raw = res?.data?.counts || res?.data || {};
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        // counts:{} ou chaves omitidas NÃO contam como fatia completa — isola ausentes.
        sliceComplete = slice.every((row) => (
          Object.prototype.hasOwnProperty.call(raw, row.entityName)
          && isValidCountValue(/** @type {Record<string, unknown>} */ (raw)[row.entityName])
        ));
        if (sliceComplete) {
          for (const row of slice) {
            result[row.entityName] = /** @type {Record<string, unknown>} */ (raw)[row.entityName];
          }
          continue;
        }
        for (const row of slice) {
          if (
            Object.prototype.hasOwnProperty.call(raw, row.entityName)
            && isValidCountValue(/** @type {Record<string, unknown>} */ (raw)[row.entityName])
          ) {
            result[row.entityName] = /** @type {Record<string, unknown>} */ (raw)[row.entityName];
          }
        }
      }
    } catch (sliceError) {
      if (typeof console !== 'undefined') {
        console.warn('[cadastrosAllCountsCore] Fatia auxiliar indisponivel; isolando entidades', sliceError);
      }
    }
    for (const row of slice) {
      if (Object.prototype.hasOwnProperty.call(result, row.entityName) && isValidCountValue(result[row.entityName])) {
        continue;
      }
      try {
        const one = await invoke('countEntities', {
          entities: [{ entityName: row.entityName, filter: row.filter }],
        });
        const rawOne = one?.data?.counts || one?.data || {};
        if (rawOne && typeof rawOne === 'object' && Object.prototype.hasOwnProperty.call(rawOne, row.entityName)) {
          const v = /** @type {Record<string, unknown>} */ (rawOne)[row.entityName];
          if (isValidCountValue(v)) {
            result[row.entityName] = v;
            continue;
          }
        }
        // Formato single: { count: n }
        const n = one?.data?.count;
        if (isValidCountValue(n)) {
          result[row.entityName] = n;
        }
      } catch (entityError) {
        if (typeof console !== 'undefined') {
          console.warn('[cadastrosAllCountsCore] Contagem auxiliar isolada falhou', row.entityName, entityError);
        }
      }
    }
  }
  if (Object.keys(result).length === 0) {
    throw new Error('READ_COUNT_UNAVAILABLE');
  }
  return normalizeCadastrosCounts(result, entities);
}
