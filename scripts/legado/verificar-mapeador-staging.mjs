import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import { stripSegredosMigracao } from '../../src/components/lib/migracaoErpPolicy.js';
import { mapLegadoLoteSintetico } from './mapear-registro-sintetico.mjs';
import { prepararLoteStagingLegado, reconciliarPlanoStagingLegado } from './staging-scope-gate.mjs';

const ENTIDADES_MESTRE = Object.freeze({ cliente: 'cliente', produto_revenda: 'produto' });
const GRUPO_ALIASES = new Set(['group_id', 'grupo_id', 'groupid', 'grupoid']);
const EMPRESA_ALIASES = new Set(['codigo_empresa', 'codigoempresa', 'cod_empresa', 'codempresa', 'empresa_codigo', 'empresacodigo', 'empresa_id', 'empresaid']);

/**
 * Contrato de integracao somente em memoria. Nenhum registro e persistido.
 * A aprovacao de staging real depende de prova externa do Grupo e da revisao da #48.
 */
export function verificarMapeadorParaStaging(rows, {
  entidade,
  groupId,
  grupoComprovado = false,
  arquivoNome = 'sintetico.csv',
  existentes = [],
  contagensEsperadas,
} = {}) {
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
      const alias = key.toLowerCase();
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
  if (mapeado.erros.length || mapeado.quarentenas.length || mapeado.reusos.length) {
    return { bloqueado: true, privados: [], relatorio: {
      origem: rows.length, aptos: 0, reusos: mapeado.reusos.length,
      erros: mapeado.erros.length, quarentena: mapeado.quarentenas.length,
    } };
  }
  if (mapeado.gravados.some((row) => row.group_id !== groupId || row.empresa_id)) {
    throw new Error('Mapeador alterou o escopo validado.');
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
