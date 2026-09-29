/**
 * Preflight de escopo para staging isolado. Nao grava nem importa registros.
 * O codigo do seletor (003 Grupo, 001/002/005 Empresas) nao prova sozinho
 * a pessoa juridica emissora de uma operacao.
 */
import { stripSegredosMigracao } from '../../src/components/lib/migracaoErpPolicy.js';
const MESTRES_GRUPO = new Set(['cliente', 'fornecedor', 'produto_revenda']);
const OPERACOES = new Set(['pedido', 'estoque', 'conta_receber', 'conta_pagar', 'nota_fiscal']);
const CODIGOS_EMPRESA = new Set(['001', '002', '005']);

const codigo = (value) => {
  const raw = String(value ?? '').trim();
  return /^\d{1,3}$/.test(raw) ? raw.padStart(3, '0') : '';
};

export function avaliarEscopoStagingLegado({ entidade, codigoEmpresaLegado, groupId, empresaId, vinculosVerificados = {} }) {
  const motivos = [];
  if (!groupId) motivos.push('grupo_nao_informado');
  if (!MESTRES_GRUPO.has(entidade) && !OPERACOES.has(entidade)) motivos.push('entidade_nao_suportada');
  if (MESTRES_GRUPO.has(entidade)) {
    if (empresaId) motivos.push('mestre_grupo_nao_pode_ser_duplicado_na_empresa');
  } else if (OPERACOES.has(entidade)) {
    const legado = codigo(codigoEmpresaLegado);
    if (!CODIGOS_EMPRESA.has(legado)) motivos.push('empresa_legada_nao_comprovada');
    const vinculo = vinculosVerificados[legado];
    if (!vinculo?.empresaId || vinculo.groupId !== groupId || vinculo.empresaId !== empresaId || vinculo.comprovado !== true) {
      motivos.push('vinculo_juridico_nao_comprovado');
    }
  }
  return { aptoParaStaging: motivos.length === 0, motivos, destino: 'staging_isolado' };
}

export function reconciliarEscoposStaging(itens) {
  const totais = { origem: 0, aptos: 0, quarentena: 0, porMotivo: {} };
  for (const item of itens) {
    totais.origem += 1;
    const resultado = avaliarEscopoStagingLegado(item);
    if (resultado.aptoParaStaging) totais.aptos += 1;
    else {
      totais.quarentena += 1;
      for (const motivo of resultado.motivos) totais.porMotivo[motivo] = (totais.porMotivo[motivo] || 0) + 1;
    }
  }
  return totais;
}

/**
 * Prepara somente em memoria um lote ja extraido para staging isolado.
 * Nunca persiste nem publica registros: o relatorio contem apenas agregados.
 * A chave usa tenant, entidade e codigo legado; um retry identico e reuso,
 * enquanto uma divergencia na mesma chave exige conciliacao humana.
 */
export function prepararLoteStagingLegado(itens, { autorizado = false, vinculosVerificados = {}, existentes = [] } = {}) {
  if (autorizado !== true) throw new Error('Permissao de preparar staging legado obrigatoria.');
  if (!Array.isArray(itens) || itens.length === 0) throw new Error('Lote legado vazio ou invalido.');
  if (!Array.isArray(existentes)) throw new Error('Indice de staging existente invalido.');
  const porChave = new Map();
  const privados = [];
  const relatorio = { origem: itens.length, aptos: 0, reusos: 0, conflitos: 0, quarentena: 0, porEntidadeEmpresa: {}, porMotivo: {} };
  const contar = (objeto, chave) => { objeto[chave] = (objeto[chave] || 0) + 1; };
  for (const anterior of existentes) {
    const chave = JSON.stringify([
      String(anterior?.groupId ?? '').trim(), String(anterior?.empresaId ?? '').trim(),
      String(anterior?.entidade ?? '').trim(), String(anterior?.codigoLegado ?? '').trim(),
    ]);
    const assinatura = String(anterior?.assinaturaOrigem ?? '').trim();
    if (!String(anterior?.groupId ?? '').trim() || !String(anterior?.entidade ?? '').trim()
      || !String(anterior?.codigoLegado ?? '').trim() || !/^[a-f0-9]{64}$/.test(assinatura)) {
      throw new Error('Indice de staging existente sem identidade e assinatura validas.');
    }
    if (porChave.has(chave) && porChave.get(chave) !== assinatura) {
      throw new Error('Indice de staging existente com conflito de origem.');
    }
    porChave.set(chave, assinatura);
  }
  for (const item of itens) {
    const entidade = String(item?.entidade ?? '').trim();
    const groupId = String(item?.groupId ?? '').trim();
    const empresaId = String(item?.empresaId ?? '').trim();
    const legado = codigo(item?.codigoEmpresaLegado);
    const codigoLegado = String(item?.codigoLegado ?? '').trim();
    const escopo = avaliarEscopoStagingLegado({ entidade, codigoEmpresaLegado: legado, groupId, empresaId, vinculosVerificados });
    const motivos = [...escopo.motivos];
    if (!codigoLegado) motivos.push('codigo_legado_ausente');
    if (motivos.length) {
      relatorio.quarentena += 1;
      for (const motivo of motivos) contar(relatorio.porMotivo, motivo);
      continue;
    }
    const chave = JSON.stringify([groupId, empresaId, entidade, codigoLegado]);
    const assinatura = String(item.assinaturaOrigem ?? '').trim();
    if (!/^[a-f0-9]{64}$/.test(assinatura)) {
      relatorio.quarentena += 1;
      contar(relatorio.porMotivo, 'assinatura_origem_ausente');
      continue;
    }
    const anterior = porChave.get(chave);
    if (anterior) {
      if (anterior === assinatura) relatorio.reusos += 1;
      else {
        relatorio.conflitos += 1;
        contar(relatorio.porMotivo, 'codigo_legado_conflitante');
      }
      continue;
    }
    porChave.set(chave, assinatura);
    privados.push(stripSegredosMigracao(item));
    relatorio.aptos += 1;
    contar(relatorio.porEntidadeEmpresa, `${entidade}|${empresaId ? legado : 'grupo'}`);
  }
  const bloqueado = relatorio.conflitos > 0 || relatorio.quarentena > 0;
  // Nao entregar lote parcial ao consumidor: o relatorio preserva apenas contagens.
  return { privados: bloqueado ? [] : privados, relatorio, bloqueado };
}
