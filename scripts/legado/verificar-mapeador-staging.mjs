import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import { stripSegredosMigracao } from '../../src/components/lib/migracaoErpPolicy.js';
import { mapLegadoLoteSintetico } from './mapear-registro-sintetico.mjs';
import { prepararLoteStagingLegado, reconciliarPlanoStagingLegado } from './staging-scope-gate.mjs';

const ENTIDADES_MESTRE = Object.freeze({ cliente: 'cliente', fornecedor: 'fornecedor', produto_revenda: 'produto' });
const GRUPO_ALIASES = new Set(['groupid', 'grupoid']);
const EMPRESA_ALIASES = new Set(['codigoempresa', 'codempresa', 'empresacodigo', 'empresaid', 'codigoempresalegado']);
const normalizarAlias = (key) => key.toLowerCase().replace(/[\s._-]/g, '');

const exigirDadosSimples = (value, mensagem, visitados = new Set()) => {
  if (typeof value === 'function') throw new Error(mensagem);
  if (value === null || typeof value !== 'object') return;
  if (utilTypes.isProxy(value) || visitados.has(value)) throw new Error(mensagem);
  visitados.add(value);
  const prototipo = Object.getPrototypeOf(value);
  if (prototipo !== null && prototipo !== (Array.isArray(value) ? Array.prototype : Object.prototype)) {
    throw new Error(mensagem);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') throw new Error(mensagem);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error(mensagem);
    exigirDadosSimples(descriptor.value, mensagem, visitados);
  }
  visitados.delete(value);
};

/**
 * Contrato de integracao somente em memoria. Nenhum registro e persistido.
 * A aprovacao de staging real depende de prova externa do Grupo e da revisao da #48.
 */
export function verificarMapeadorParaStaging(rows, opcoes = {}) {
  exigirDadosSimples(opcoes, 'Opcoes do staging invalidas: indice dinamico nao permitido.');
  exigirDadosSimples(rows, 'Registro legado dinamico nao permitido: exige registros JSON simples.');
  const {
    entidade,
    groupId,
    grupoComprovado = false,
    arquivoNome = 'sintetico.csv',
    existentes = [],
    contagensEsperadas,
  } = opcoes;
  exigirDadosSimples(existentes, 'Indice de staging dinamico nao permitido.');
  if (grupoComprovado !== true || !groupId) throw new Error('Grupo de destino nao comprovado.');
  const tipoMapeador = ENTIDADES_MESTRE[entidade];
  if (!tipoMapeador) throw new Error('Entidade sem mapeador mestre homologado para staging.');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Lote vazio ou invalido.');
  if (!Array.isArray(existentes)) throw new Error('Indice de staging existente invalido.');

  const indice = existentes.map((item) => {
    if (utilTypes.isProxy(item)) throw new Error('Indice de staging dinamico nao permitido.');
    return stripSegredosMigracao(item);
  });
  if (indice.some((item) => String(item?.groupId ?? '').trim() !== groupId)) {
    throw new Error('Indice de staging mistura Grupos.');
  }

  // Valida o lote inteiro antes de permitir que o mapeador leia aliases.
  const seguros = rows.map((row) => {
    if (utilTypes.isProxy(row)) throw new Error('Registro legado dinamico nao permitido.');
    return stripSegredosMigracao(row);
  });

  // Escopo canônico vindo de linha/arquivo nao pode suplantar o destino validado.
  for (const row of seguros) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Registro legado invalido.');
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && typeof value === 'object') {
        throw new Error('Registro legado aninhado nao permitido.');
      }
      const alias = normalizarAlias(key);
      const valor = String(value ?? '').trim();
      if (GRUPO_ALIASES.has(alias) && valor && valor !== groupId) {
        throw new Error('Grupo da linha diverge do destino validado.');
      }
      if (EMPRESA_ALIASES.has(alias) && valor) {
        throw new Error('Mestre do Grupo com vinculo empresarial legado nao comprovado.');
      }
    }
  }

  const mapeado = mapLegadoLoteSintetico(seguros, {
    entidade: tipoMapeador,
    groupId,
    arquivoNome,
  });
  if (mapeado.erros.length || mapeado.quarentenas.length || mapeado.reusos.length || mapeado.excluidos.length) {
    return { bloqueado: true, privados: [], relatorio: {
      origem: rows.length, aptos: 0, reusos: mapeado.reusos.length,
      erros: mapeado.erros.length, quarentena: mapeado.quarentenas.length,
      excluidos: mapeado.excluidos.length,
    } };
  }
  if (mapeado.gravados.some((row) => row.group_id !== groupId || row.empresa_id)) {
    throw new Error('Mapeador alterou o escopo validado.');
  }
  if (mapeado.gravados.some((row) => row.codigo_empresa_legado
    || row.empresa_legado_papel === 'empresa')) {
    throw new Error('Mapeador devolveu vinculo empresarial legado nao comprovado.');
  }
  const itens = mapeado.gravados.map((row) => ({
    entidade,
    groupId,
    codigoLegado: row.codigo_legado,
    assinaturaOrigem: createHash('sha256').update(JSON.stringify({
      codigo: row.codigo_legado,
      nome: row.nome,
      descricao: row.descricao,
      documento: row.documento,
    })).digest('hex'),
  }));
  const preparados = contagensEsperadas === undefined
    ? prepararLoteStagingLegado(itens, { autorizado: true, existentes: indice })
    : reconciliarPlanoStagingLegado({ itens, existentes: indice, groupId, autorizado: true, contagensEsperadas });
  const novosCodigos = new Set(preparados.privados.map((row) => row.codigoLegado));
  return { bloqueado: preparados.bloqueado,
    privados: preparados.bloqueado ? [] : mapeado.gravados.filter((row) => novosCodigos.has(row.codigo_legado)),
    relatorio: { origem: rows.length, aptos: preparados.relatorio.aptos,
      reusos: preparados.relatorio.reusos, erros: 0,
      conflitos: preparados.relatorio.conflitos,
      quarentena: preparados.relatorio.quarentena,
      ...(contagensEsperadas === undefined ? {} : {
        divergencias: preparados.relatorio.divergencias,
        porEntidadeEmpresaOrigem: preparados.relatorio.porEntidadeEmpresaOrigem,
      }) } };
}

/**
 * Prepara os mestres do Grupo como uma unica unidade de reconciliacao.
 * Nenhum registro privado sai se qualquer entidade falhar ou divergir.
 */
export function verificarLoteMestresParaStaging(lotes, opcoes = {}) {
  if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes) || utilTypes.isProxy(opcoes)
    || Object.values(Object.getOwnPropertyDescriptors(opcoes)).some((descriptor) =>
      'get' in descriptor || 'set' in descriptor)) {
    throw new Error('Opcoes do lote de mestres invalidas.');
  }
  if (!lotes || typeof lotes !== 'object' || Array.isArray(lotes) || utilTypes.isProxy(lotes)) {
    throw new Error('Lotes de mestres invalidos.');
  }
  if (Object.values(Object.getOwnPropertyDescriptors(lotes)).some((descriptor) =>
    'get' in descriptor || 'set' in descriptor)) {
    throw new Error('Lotes de mestres exigem registros JSON simples.');
  }
  const entradas = Object.entries(lotes);
  if (entradas.length === 0 || entradas.some(([entidade, rows]) =>
    !ENTIDADES_MESTRE[entidade] || !Array.isArray(rows) || utilTypes.isProxy(rows) || rows.length === 0
    || Object.values(Object.getOwnPropertyDescriptors(rows)).some((descriptor) =>
      'get' in descriptor || 'set' in descriptor))) {
    throw new Error('Entidade ou lote de mestres invalido.');
  }
  exigirDadosSimples(opcoes, 'Opcoes do lote de mestres invalidas.');
  exigirDadosSimples(lotes, 'Entidade ou lote de mestres invalido.');
  if (!Array.isArray(opcoes.contagensEsperadas)) {
    throw new Error('Contagens esperadas invalidas.');
  }
  if (opcoes.contagensEsperadas && (utilTypes.isProxy(opcoes.contagensEsperadas)
    || Object.values(Object.getOwnPropertyDescriptors(opcoes.contagensEsperadas)).some((descriptor) =>
      'get' in descriptor || 'set' in descriptor))) {
    throw new Error('Contagens esperadas invalidas.');
  }
  if (opcoes.contagensEsperadas?.some((item) => !entradas.some(([entidade]) => entidade === item?.entidade))) {
    throw new Error('Contagem esperada sem lote correspondente.');
  }
  if (opcoes.contagensEsperadas.length !== entradas.length
    || new Set(opcoes.contagensEsperadas.map((item) => item.entidade)).size !== entradas.length) {
    throw new Error('Contagens esperadas incompletas para o lote de mestres.');
  }
  const resultados = entradas.map(([entidade, rows]) => [entidade, verificarMapeadorParaStaging(rows, {
    ...opcoes,
    entidade,
    contagensEsperadas: opcoes.contagensEsperadas?.filter((item) => item?.entidade === entidade),
  })]);
  const bloqueado = resultados.some(([, resultado]) => resultado.bloqueado);
  return {
    bloqueado,
    privados: bloqueado ? [] : resultados.flatMap(([entidade, resultado]) =>
      resultado.privados.map((registro) => ({ entidadeStaging: entidade, registro }))),
    relatorio: Object.fromEntries(resultados.map(([entidade, resultado]) => [entidade, resultado.relatorio])),
  };
}
