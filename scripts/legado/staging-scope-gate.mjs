/**
 * Preflight de escopo para staging isolado. Nao grava nem importa registros.
 * O codigo do seletor (003 Grupo, 001/002/005 Empresas) nao prova sozinho
 * a pessoa juridica emissora de uma operacao.
 */
import { stripSegredosMigracao } from '../../src/components/lib/migracaoErpPolicy.js';
const MESTRES_GRUPO = new Set(['cliente', 'fornecedor', 'produto_revenda']);
const OPERACOES = new Set(['pedido', 'estoque', 'conta_receber', 'conta_pagar', 'nota_fiscal']);
const CODIGOS_EMPRESA = new Set(['001', '002', '005']);
const TIPOS_EVIDENCIA = new Set(['cnpj', 'documento_fiscal']);

const atestacaoComFormatoValido = (vinculo) => {
  const evidencia = vinculo?.evidencia;
  const data = evidencia?.aprovadoEm;
  const dataValida = typeof data === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(data)
    && Number.isFinite(Date.parse(data))
    && new Date(data).toISOString() === (data.includes('.') ? data : data.replace('Z', '.000Z'));
  return vinculo?.comprovado === true
    && TIPOS_EVIDENCIA.has(evidencia?.tipo)
    && typeof evidencia?.sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(evidencia.sha256)
    && !/^0{64}$/.test(evidencia.sha256)
    && typeof evidencia?.aprovadoPor === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidencia.aprovadoPor)
    && dataValida;
};

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
    if (!vinculo?.empresaId || vinculo.groupId !== groupId || vinculo.empresaId !== empresaId || !atestacaoComFormatoValido(vinculo)) {
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
    const entidadeExistente = String(anterior?.entidade ?? '').trim();
    const empresaExistente = String(anterior?.empresaId ?? '').trim();
    const chave = JSON.stringify([
      String(anterior?.groupId ?? '').trim(), empresaExistente,
      entidadeExistente, String(anterior?.codigoLegado ?? '').trim(),
    ]);
    const assinatura = String(anterior?.assinaturaOrigem ?? '').trim();
    if (!String(anterior?.groupId ?? '').trim() || !entidadeExistente
      || !String(anterior?.codigoLegado ?? '').trim() || !/^[a-f0-9]{64}$/.test(assinatura)
      || (OPERACOES.has(entidadeExistente) && !empresaExistente)
      || (MESTRES_GRUPO.has(entidadeExistente) && empresaExistente)
      || (String(anterior?.empresaId ?? '') && !empresaExistente)) {
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

/**
 * Reconcilia um lote sintetico em um unico Grupo antes de entregar qualquer
 * registro privado ao staging. Contagens sao independentes da deduplicacao:
 * retry continua sendo uma linha de origem, mas nao uma nova linha de destino.
 * Dependencias so podem apontar para mestre do Grupo ou operacao da mesma Empresa.
 */
export function reconciliarPlanoStagingLegado({
  itens, existentes = [], vinculosVerificados = {}, autorizado = false, groupId, contagensEsperadas = [],
} = {}) {
  const grupo = String(groupId ?? '').trim();
  if (!grupo) throw new Error('Grupo do plano de staging obrigatorio.');
  if (!Array.isArray(itens) || !Array.isArray(existentes) || !Array.isArray(contagensEsperadas)) {
    throw new Error('Plano de staging exige listas validas.');
  }
  // Valida estruturas JSON antes de qualquer leitura de campos usada no relatorio.
  const linhas = itens.map((item) => stripSegredosMigracao(item));
  const indice = existentes.map((item) => stripSegredosMigracao(item));
  if ([...linhas, ...indice].some((item) => String(item?.groupId ?? '').trim() !== grupo)) {
    throw new Error('Plano de staging mistura Grupos.');
  }
  const preparado = prepararLoteStagingLegado(linhas, { autorizado, vinculosVerificados, existentes: indice });
  if (preparado.bloqueado) return preparado;
  const porMotivo = { ...preparado.relatorio.porMotivo };
  const contar = (motivo) => { porMotivo[motivo] = (porMotivo[motivo] || 0) + 1; };
  const chave = (item) => JSON.stringify([
    grupo, String(item?.empresaId ?? '').trim(), String(item?.entidade ?? '').trim(),
    String(item?.codigoLegado ?? '').trim(),
  ]);
  const conhecidos = new Set([...indice, ...preparado.privados].map(chave));
  // Inclui retries do lote: eles podem fechar um ciclo com uma linha nova.
  const idsLote = new Set(linhas.map(chave));
  const dependentes = new Map([...idsLote].map((id) => [id, new Set()]));
  const graus = new Map([...idsLote].map((id) => [id, 0]));
  let dependenciasPendentes = 0;
  for (const item of linhas) {
    const itemKey = chave(item);
    const deps = item?.dependencias ?? [];
    if (!Array.isArray(deps)) throw new Error('Dependencias do staging invalidas.');
    for (const dep of deps) {
      if (!dep || typeof dep !== 'object' || Array.isArray(dep)
        || Object.keys(dep).some((campo) => !['entidade', 'codigoLegado', 'escopo'].includes(campo))) {
        throw new Error('Dependencia do staging contem campos nao permitidos.');
      }
      const entidade = String(dep?.entidade ?? '').trim();
      const codigoLegado = String(dep?.codigoLegado ?? '').trim();
      const escopo = String(dep?.escopo ?? '').trim();
      const empresaId = escopo === 'empresa' ? String(item?.empresaId ?? '').trim() : '';
      const depKey = JSON.stringify([grupo, empresaId, entidade, codigoLegado]);
      const tipoValido = escopo === 'grupo' ? MESTRES_GRUPO.has(entidade)
        : escopo === 'empresa' && OPERACOES.has(entidade);
      if (!tipoValido || !codigoLegado || (escopo === 'empresa' && !empresaId)
        || !conhecidos.has(depKey)) {
        dependenciasPendentes += 1;
        contar('dependencia_nao_comprovada');
      } else if (idsLote.has(depKey) && !dependentes.get(depKey).has(itemKey)) {
        dependentes.get(depKey).add(itemKey);
        graus.set(itemKey, graus.get(itemKey) + 1);
      }
    }
  }
  const fila = [...graus].filter(([, grau]) => grau === 0).map(([id]) => id);
  let ordenados = 0;
  while (fila.length > 0) {
    const id = fila.pop();
    ordenados += 1;
    for (const dependente of dependentes.get(id)) {
      const grau = graus.get(dependente) - 1;
      graus.set(dependente, grau);
      if (grau === 0) fila.push(dependente);
    }
  }
  const dependenciasCiclicas = idsLote.size - ordenados;
  if (dependenciasCiclicas > 0) contar('dependencia_ciclica');
  const observadas = {};
  for (const item of linhas) {
    const entidade = String(item.entidade).trim();
    const empresa = String(item.empresaId ?? '').trim() ? codigo(item.codigoEmpresaLegado) : 'grupo';
    const categoria = `${entidade}|${empresa}`;
    observadas[categoria] = (observadas[categoria] || 0) + 1;
  }
  const esperadas = {};
  for (const entrada of contagensEsperadas) {
    const entidade = String(entrada?.entidade ?? '').trim();
    const empresa = String(entrada?.codigoEmpresaLegado ?? '').trim();
    const quantidade = entrada?.quantidade;
    const categoria = `${entidade}|${empresa}`;
    if ((!MESTRES_GRUPO.has(entidade) && !OPERACOES.has(entidade))
      || (MESTRES_GRUPO.has(entidade) && empresa !== 'grupo')
      || (OPERACOES.has(entidade) && !CODIGOS_EMPRESA.has(empresa))
      || typeof quantidade !== 'number' || !Number.isSafeInteger(quantidade)
      || quantidade < 0 || categoria in esperadas) {
      throw new Error('Contagens esperadas do staging invalidas.');
    }
    esperadas[categoria] = quantidade;
  }
  const categorias = new Set([...Object.keys(observadas), ...Object.keys(esperadas)]);
  let divergencias = 0;
  for (const categoria of categorias) {
    if ((observadas[categoria] || 0) !== (esperadas[categoria] || 0)) {
      divergencias += 1;
      contar('contagem_origem_divergente');
    }
  }
  const bloqueado = dependenciasPendentes > 0 || dependenciasCiclicas > 0 || divergencias > 0;
  return {
    privados: bloqueado ? [] : preparado.privados,
    bloqueado,
    relatorio: { ...preparado.relatorio, porMotivo, porEntidadeEmpresaOrigem: observadas,
      dependenciasPendentes, dependenciasCiclicas, divergencias },
  };
}
