import { createHash } from 'node:crypto';
import { stripSegredosMigracao } from '../../src/components/lib/migracaoErpPolicy.js';
import { mapLegadoLoteSintetico } from './mapear-registro-sintetico.mjs';
import { prepararLoteStagingLegado } from './staging-scope-gate.mjs';

const ENTIDADES_MESTRE = Object.freeze({ cliente: 'cliente', produto_revenda: 'produto' });

/**
 * Contrato de integracao somente em memoria. Nenhum registro e persistido.
 * A aprovacao de staging real depende de prova externa do Grupo e da revisao da #48.
 */
export function verificarMapeadorParaStaging(rows, {
  entidade,
  groupId,
  grupoComprovado = false,
  arquivoNome = 'sintetico.csv',
} = {}) {
  if (grupoComprovado !== true || !groupId) throw new Error('Grupo de destino nao comprovado.');
  const tipoMapeador = ENTIDADES_MESTRE[entidade];
  if (!tipoMapeador) throw new Error('Entidade sem mapeador mestre homologado para staging.');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Lote vazio ou invalido.');

  // Valida o lote inteiro antes de permitir que o mapeador leia aliases.
  const seguros = rows.map((row) => stripSegredosMigracao(row));

  // Escopo canônico vindo de linha/arquivo nao pode suplantar o destino validado.
  for (const row of seguros) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Registro legado invalido.');
    const grupoLinha = String(row.group_id ?? row.grupo_id ?? '').trim();
    if (grupoLinha && grupoLinha !== groupId) throw new Error('Grupo da linha diverge do destino validado.');
    if (row.empresa_id != null && String(row.empresa_id).trim()) {
      throw new Error('Mestre do Grupo nao pode receber empresa proprietaria.');
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
  const preparados = prepararLoteStagingLegado(mapeado.gravados.map((row) => ({
    entidade,
    groupId,
    codigoLegado: row.codigo_legado,
    assinaturaOrigem: createHash('sha256').update(JSON.stringify({
      codigo: row.codigo_legado,
      nome: row.nome,
      descricao: row.descricao,
      documento: row.documento,
    })).digest('hex'),
  })), { autorizado: true });
  return { bloqueado: preparados.bloqueado, privados: preparados.bloqueado ? [] : mapeado.gravados,
    relatorio: { origem: rows.length, aptos: preparados.relatorio.aptos,
      reusos: preparados.relatorio.reusos, erros: 0,
      quarentena: preparados.relatorio.quarentena } };
}
