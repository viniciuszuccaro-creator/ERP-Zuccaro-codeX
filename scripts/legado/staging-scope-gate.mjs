/**
 * Preflight de escopo para staging isolado. Nao grava nem importa registros.
 * O codigo do seletor (003 Grupo, 001/002/005 Empresas) nao prova sozinho
 * a pessoa juridica emissora de uma operacao.
 */
const MESTRES_GRUPO = new Set(['cliente', 'fornecedor', 'produto_revenda']);
const OPERACOES = new Set(['pedido', 'estoque', 'conta_receber', 'conta_pagar', 'nota_fiscal']);
const CODIGOS_EMPRESA = new Set(['001', '002', '005']);

const codigo = (value) => String(value ?? '').trim().padStart(3, '0');

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
