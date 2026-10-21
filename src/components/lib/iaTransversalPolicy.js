import { validarRespostaFiscalIA } from './iaResponsePolicy.js';
export { validarPosicoesCorteDobraIA } from './iaResponsePolicy.js';
import { buildFinanceAnomalySuggestions, buildConciliacaoMatchSuggestions, buildFluxoCaixaProjection } from './iaFinancePolicy.js';
export { buildFinanceAnomalySuggestions, buildConciliacaoMatchSuggestions, buildFluxoCaixaProjection };

import {
  firstText, IA_MODO_SUGESTAO, sanitizeIaPrompt, isSensitiveIaExecution, stampIaSuggestion,
  assertIaInvocation, assertIaUiContext, assertAnomalyScanContext, assertForecastUiContext,
} from './iaInvocationPolicy.js';

export {
  IA_MODO_SUGESTAO, sanitizeIaPrompt, isSensitiveIaExecution, stampIaSuggestion,
  assertIaInvocation, assertIaUiContext, assertAnomalyScanContext, assertForecastUiContext,
};

export const buildChurnSuggestions = ({ clientes = [], pedidos = [], hoje = new Date() } = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  return (clientes || [])
    .filter((cliente) => String(cliente.status || 'Ativo') === 'Ativo')
    .map((cliente) => {
      const ultimaCompra = cliente.data_ultima_compra ? new Date(cliente.data_ultima_compra) : null;
      const diasSemComprar = ultimaCompra
        ? Math.floor((now.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      let riscoChurn = 'Baixo';
      if (diasSemComprar > 180) riscoChurn = 'Crítico';
      else if (diasSemComprar > 120) riscoChurn = 'Alto';
      else if (diasSemComprar > 60) riscoChurn = 'Médio';
      const scoreAtual = Number(cliente.score_saude_cliente) || 100;
      let novoScore = scoreAtual;
      if (diasSemComprar > 60) novoScore -= (diasSemComprar - 60) * 0.5;
      if (novoScore < 0) novoScore = 0;
      return {
        ...cliente,
        pedidos_count: (pedidos || []).filter((pedido) => pedido.cliente_id === cliente.id).length,
        dias_sem_comprar: diasSemComprar,
        risco_churn: riscoChurn,
        score_saude_cliente: Math.round(novoScore),
      };
    })
    .filter((item) => item.risco_churn === 'Alto' || item.risco_churn === 'Crítico');
};

export const buildChurnOportunidade = (cliente = {}) => ({
  cliente_id: cliente.id,
  titulo: `Recuperação - ${cliente.nome}`,
  descricao: `Sugestao de IA: cliente em risco de churn (${cliente.risco_churn}) - ${cliente.dias_sem_comprar} dias sem comprar`,
  valor_estimado: cliente.ticket_medio || 0,
  probabilidade: cliente.risco_churn === 'Crítico' ? 20 : 40,
  origem: 'IA - Detecção de Churn',
  status: 'Nova',
  responsavel_id: cliente.vendedor_responsavel_id,
  proxima_acao: 'Ligar para o cliente e entender motivo da inatividade',
});

/**
 * CRM ABC churn: suggest only (no create). Aligns sibling screen with Gate 16.
 */
export const buildCrmAbcChurnSuggestions = ({ clientes = [], limite = 10 } = {}) => {
  const risco = (clientes || [])
    .filter((cliente) => {
      if (!cliente?.classificacao_abc || !['A', 'B'].includes(cliente.classificacao_abc)) return false;
      if (String(cliente.status || 'Ativo') !== 'Ativo') return false;
      const dias = Number(cliente.dias_sem_comprar) || 0;
      const valorHistorico = Number(cliente.valor_compras_12meses) || 0;
      return dias > 30 && valorHistorico > 5000;
    })
    .map((cliente) => {
      const dias = Number(cliente.dias_sem_comprar) || 0;
      const motivo_risco = dias > 90 ? 'Crítico - 90+ dias' : dias > 60 ? 'Alto - 60+ dias' : 'Médio - 30+ dias';
      return {
        ...cliente,
        motivo_risco,
        prioridade_crm: dias > 90 ? 'Urgente' : 'Alta',
        risco_churn: dias > 90 ? 'Crítico' : dias > 60 ? 'Alto' : 'Médio',
      };
    })
    .slice(0, Math.max(1, Number(limite) || 10));

  return stampIaSuggestion({
    total_analisados: (clientes || []).length,
    clientes_risco: risco.length,
    sugestoes: risco,
    oportunidades_criadas: 0,
  });
};

export const buildCrmAbcChurnOportunidade = (cliente = {}) => ({
  titulo: `Risco Churn - ${cliente.nome_fantasia || cliente.nome || 'Cliente'}`,
  descricao: `Sugestao de IA: cliente classe ${cliente.classificacao_abc} sem comprar ha ${cliente.dias_sem_comprar} dias. Valor historico: R$ ${Number(cliente.valor_compras_12meses || 0).toLocaleString('pt-BR')}`,
  cliente_id: cliente.id,
  cliente_nome: cliente.nome_fantasia || cliente.nome,
  origem: 'IA Churn',
  responsavel_id: cliente.vendedor_responsavel_id,
  etapa: 'Reativação',
  valor_estimado: Math.round(Number(cliente.ticket_medio) || Number(cliente.valor_compras_12meses || 0) / 12),
  probabilidade: 40,
  temperatura: 'Morno',
  status: 'Aberto',
  score: 60,
  proxima_acao: `Contatar cliente - Risco de churn (${cliente.dias_sem_comprar} dias sem compra)`,
  observacoes: `Sugestao IA (confirmada pelo usuario). Motivo: ${cliente.motivo_risco || ''}`,
});

export const requireIaHumanConfirm = (mensagem) => {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return false;
  }
  return Boolean(window.confirm(String(mensagem || 'Confirmar aplicacao da sugestao de IA?')));
};

/** Log/auditoria de IA sempre como sugestao (nunca Automático). */
export const stampIaLogSugestao = (record = {}) => ({
  ...record,
  resultado: firstText(record.resultado) && !String(record.resultado).toLowerCase().includes('autom')
    ? record.resultado
    : 'Sugestao',
  modo: IA_MODO_SUGESTAO,
  group_id: firstText(record.group_id) || undefined,
  empresa_id: firstText(record.empresa_id) || undefined,
});

/**
 * Upsell/reposicao local a partir de pedidos no contexto (Gate 16).
 */
export const buildUpsellSuggestions = ({ pedidos = [], pedidoAtual = null, hoje = new Date() } = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  const list = Array.isArray(pedidos) ? pedidos : [];
  const sugestoes = [];
  const ultimoPedido = list[0];

  if (ultimoPedido?.data_pedido) {
    const diasDesdeUltimoP = Math.floor((now.getTime() - new Date(ultimoPedido.data_pedido).getTime()) / (1000 * 60 * 60 * 24));
    if (diasDesdeUltimoP >= 25 && diasDesdeUltimoP <= 35) {
      sugestoes.push({
        tipo: 'reposicao',
        prioridade: 'alta',
        titulo: 'Ciclo de Reposição Detectado',
        descricao: `Cliente compra a cada ~30 dias. Ultima compra ha ${diasDesdeUltimoP} dias.`,
        acao: 'Sugerir produtos do ultimo pedido',
        produtos: ultimoPedido.itens_revenda?.map((i) => i.produto_id) || [],
      });
    }
  }

  const margemMedia = list.reduce((sum, p) => sum + (Number(p.margem_total_percentual) || 0), 0) / (list.length || 1);
  if (margemMedia > 25 && Number(pedidoAtual?.margem_total_percentual) < 20) {
    sugestoes.push({
      tipo: 'precificacao',
      prioridade: 'media',
      titulo: 'Oportunidade de Aumentar Margem',
      descricao: `Margem atual: ${Number(pedidoAtual.margem_total_percentual).toFixed(1)}%. Historico permite ${margemMedia.toFixed(1)}%.`,
      acao: 'Revisar precos (sugestao; nao aplica sozinho)',
    });
  }

  const produtosComprados = list.flatMap((p) => p.itens_revenda || []).map((i) => String(i.produto_id || i.codigo_sku || ''));
  const temBitola = produtosComprados.some((id) => id.toLowerCase().includes('bitola') || id.includes('10mm'));
  const temArame = (pedidoAtual?.itens_revenda || []).some((i) => String(i.codigo_sku || i.descricao || '').toLowerCase().includes('arame'));
  if (temBitola && !temArame) {
    sugestoes.push({
      tipo: 'upsell',
      prioridade: 'media',
      titulo: 'Produto Complementar',
      descricao: 'Padrao de compra sugere item complementar (ex.: arame).',
      acao: 'Avaliar upsell complementar',
    });
  }

  return stampIaSuggestion({
    total_pedidos: list.length,
    sugestoes,
    fonte: 'ia_upsell_local',
  });
};

export const buildRecomendacaoFromPedidos = ({ pedidos = [], itensAtuais = [], limite = 5 } = {}) => {
  const produtosMaisComprados = {};
  (pedidos || []).forEach((p) => {
    (p.itens_revenda || []).forEach((item) => {
      const id = firstText(item.produto_id, item.codigo_sku);
      if (!id) return;
      if (!produtosMaisComprados[id]) {
        produtosMaisComprados[id] = {
          produto_id: item.produto_id,
          descricao: item.descricao,
          codigo_sku: item.codigo_sku,
          quantidade_total: 0,
          frequencia: 0,
          ultimo_preco: item.preco_unitario,
        };
      }
      produtosMaisComprados[id].quantidade_total += Number(item.quantidade) || 0;
      produtosMaisComprados[id].frequencia += 1;
      produtosMaisComprados[id].ultimo_preco = item.preco_unitario;
    });
  });
  const noCarrinho = new Set((itensAtuais || []).map((i) => firstText(i.produto_id)));
  const recomendacoes = Object.values(produtosMaisComprados)
    .filter((p) => !noCarrinho.has(firstText(p.produto_id)))
    .sort((a, b) => b.frequencia - a.frequencia)
    .slice(0, Math.max(1, Number(limite) || 5));
  return stampIaSuggestion({
    total_pedidos: (pedidos || []).length,
    recomendacoes,
    fonte: 'ia_recomendacao_local',
  });
};

/** SoD conflicts as suggestions only — never auto-write PerfilAcesso. */
export const buildSodConflictSuggestions = ({ perfis = [], usuarios = [] } = {}) => {
  const sugestoesPerfis = [];
  (perfis || []).forEach((perfil) => {
    const permissoes = perfil.permissoes || {};
    const conflitos = [];
    if (permissoes.cadastros_gerais?.fornecedores?.includes('incluir')
      && permissoes.financeiro?.pode_baixar_titulos) {
      conflitos.push({
        tipo_conflito: 'SoD - Fornecedor + Pagamento',
        descricao: 'Perfil permite cadastrar fornecedor E aprovar pagamentos - risco de fraude',
        severidade: 'Crítica',
      });
    }
    if (permissoes.comercial?.pedidos?.includes('incluir')
      && permissoes.fiscal?.pode_emitir_nfe
      && !permissoes.comercial?.pedidos?.includes('aprovar')) {
      conflitos.push({
        tipo_conflito: 'SoD - Pedido + NF-e sem Aprovação',
        descricao: 'Perfil permite criar pedido e emitir NF-e sem aprovação intermediária',
        severidade: 'Alta',
      });
    }
    if (permissoes.estoque?.movimentacoes?.includes('incluir')
      && permissoes.estoque?.requisicoes?.includes('aprovar')) {
      conflitos.push({
        tipo_conflito: 'SoD - Estoque Próprio',
        descricao: 'Perfil permite movimentar estoque e aprovar próprias requisições',
        severidade: 'Média',
      });
    }
    if (conflitos.length) {
      sugestoesPerfis.push({
        perfil_id: perfil.id,
        nome_perfil: perfil.nome_perfil || perfil.nome,
        conflitos,
      });
    }
  });

  const alertasUsuarios = [];
  (usuarios || []).forEach((usuario) => {
    const alertas = [];
    if (usuario.ultimo_acesso) {
      const hora = new Date(usuario.ultimo_acesso).getHours();
      if (hora < 6 || hora > 22) {
        alertas.push({
          tipo: 'Acesso Fora do Horário',
          descricao: `Último acesso às ${hora}h`,
          severidade: 'Média',
        });
      }
    }
    if (Number(usuario.tentativas_login_falhadas) > 3) {
      alertas.push({
        tipo: 'Tentativas Login Falhadas',
        descricao: `${usuario.tentativas_login_falhadas} tentativas falhadas`,
        severidade: 'Alta',
      });
    }
    if (alertas.length) {
      alertasUsuarios.push({
        usuario_id: usuario.id,
        nome: usuario.full_name || usuario.email,
        alertas,
      });
    }
  });

  return stampIaSuggestion({
    perfis_analisados: (perfis || []).length,
    usuarios_analisados: (usuarios || []).length,
    sugestoes_perfis: sugestoesPerfis,
    alertas_usuarios: alertasUsuarios,
    total_conflitos: sugestoesPerfis.reduce((n, item) => n + item.conflitos.length, 0),
    fonte: 'ia_governanca_local',
  });
};

/** @param {unknown} validacao */
export const stampIaFiscalSuggestion = (validacao) => {
  return stampIaSuggestion({ ...validarRespostaFiscalIA(validacao), emite_nf: false, fonte: 'ia_fiscal_local' });
};

/** @param {{issues?: unknown, details?: unknown, sugestoes?: unknown[], previsoes?: unknown[], warnings?: unknown[], ok?: boolean, extra?: Record<string, unknown>}} [options] */
export const stampAnomalyScanResult = ({
  issues = null,
  details = null,
  sugestoes = [],
  previsoes = [],
  warnings = [],
  ok = true,
  extra = {},
} = {}) => {
  const list = Array.isArray(details)
    ? details
    : (Array.isArray(issues) ? issues : []);
  let issueCount = list.length;
  if (typeof issues === 'number' && Number.isFinite(issues)) {
    issueCount = issues;
  } else if (Array.isArray(issues) && issues.length > 0 && typeof issues[0] !== 'object') {
    issueCount = issues.length;
  }
  return stampIaSuggestion({
    ok: ok !== false,
    anomaly: list.length > 0 || issueCount > 0,
    issues: issueCount,
    details: list,
    sugestoes: Array.isArray(sugestoes) ? sugestoes : [],
    previsoes: Array.isArray(previsoes) ? previsoes : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    fonte: firstText(extra.fonte) || 'anomalia_local',
    ...extra,
  });
};

export const buildSecurityAnomalySuggestions = ({
  logs = [],
  windowMinutes = 15,
  agora = new Date(),
} = {}) => {
  const now = agora instanceof Date ? agora : new Date(agora);
  const windowStart = new Date(now.getTime() - (Number(windowMinutes) || 15) * 60 * 1000);
  const getLogDate = (l) => {
    if (l?.data_hora) return new Date(l.data_hora);
    if (l?.created_date) return new Date(l.created_date);
    return null;
  };
  const recent = (logs || []).filter((l) => {
    const d = getLogDate(l);
    return d && d >= windowStart;
  });
  const byAction = recent.reduce((acc, l) => {
    const k = l.acao || '';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const suspicious = [];
  if ((byAction.Exclusao || byAction['Exclusão'] || 0) >= 5) {
    suspicious.push({
      tipo: 'Exclusoes em massa',
      severidade: 'Alta',
      detalhes: `Exclusoes recentes: ${byAction.Exclusao || byAction['Exclusão'] || 0}`,
    });
  }
  const perfilChanges = recent.filter((l) => (
    l.entidade === 'PerfilAcesso' && (l.acao === 'Criacao' || l.acao === 'Criação' || l.acao === 'Edicao' || l.acao === 'Edição')
  ));
  if (perfilChanges.length >= 3) {
    suspicious.push({
      tipo: 'Mudancas frequentes de perfil',
      severidade: 'Media',
      detalhes: `${perfilChanges.length} mudancas em ${windowMinutes} min`,
    });
  }
  const blocks = recent.filter((l) => l.acao === 'Bloqueio');
  if (blocks.length >= 10) {
    suspicious.push({
      tipo: 'Muitos bloqueios de acesso',
      severidade: 'Media',
      detalhes: `${blocks.length} bloqueios em ${windowMinutes} min`,
    });
  }
  return stampIaSuggestion({
    alerts: suspicious,
    analyzed: recent.length,
    anomaly: suspicious.length > 0,
    fonte: 'anomalia_seguranca_local',
  });
};

export const buildReposicaoSuggestions = ({
  produtos = [],
  movimentacoes = [],
  empresaId = null,
  hoje = new Date(),
} = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  const ha30Dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sugestoes = [];

  (produtos || [])
    .filter((p) => (!empresaId || p.empresa_id === empresaId) && String(p.status || 'Ativo') === 'Ativo')
    .forEach((produto) => {
      const disponivel = (Number(produto.estoque_atual) || 0) - (Number(produto.estoque_reservado) || 0);
      const minimo = Number(produto.estoque_minimo) || 0;
      const saidas = (movimentacoes || []).filter((m) => (
        m.produto_id === produto.id
        && String(m.tipo_movimento || '').toLowerCase() === 'saida'
        && m.data_movimentacao
        && new Date(m.data_movimentacao) >= ha30Dias
      ));
      const consumoTotal = saidas.reduce((sum, m) => sum + (Number(m.quantidade) || 0), 0);
      const consumoMedioDiario = consumoTotal / 30;
      const consumoProjetado30Dias = consumoMedioDiario * 30;
      if (disponivel < minimo || consumoProjetado30Dias > disponivel) {
        const quantidadeSugerida = Math.ceil(Math.max(
          minimo - disponivel,
          consumoProjetado30Dias - disponivel,
        ));
        sugestoes.push({
          produto_id: produto.id,
          produto_descricao: produto.descricao,
          produto_codigo: produto.codigo,
          estoque_atual: produto.estoque_atual,
          estoque_disponivel: disponivel,
          estoque_minimo: minimo,
          consumo_medio_diario: Number(consumoMedioDiario.toFixed(2)),
          consumo_projetado_30d: Number(consumoProjetado30Dias.toFixed(2)),
          quantidade_sugerida: quantidadeSugerida,
          criticidade: disponivel < minimo ? 'alta' : 'media',
          motivo: disponivel < minimo
            ? 'Estoque abaixo do minimo'
            : 'Consumo projetado excede disponivel',
        });
      }
    });

  sugestoes.sort((a, b) => (b.criticidade === 'alta' ? 1 : 0) - (a.criticidade === 'alta' ? 1 : 0));
  return stampIaSuggestion({
    sugestoes,
    total: sugestoes.length,
    fonte: 'previsao_reposicao_local',
  });
};

export const buildVendasRecompraSuggestions = ({
  clientes = [],
  pedidos = [],
  hoje = new Date(),
  probabilidadeMinima = 60,
} = {}) => {
  const now = hoje instanceof Date ? hoje : new Date(hoje);
  const previsoes = [];

  (clientes || [])
    .filter((c) => String(c.status || 'Ativo') === 'Ativo' && c.data_ultima_compra)
    .forEach((cliente) => {
      const pedidosCliente = (pedidos || []).filter((p) => p.cliente_id === cliente.id);
      if (pedidosCliente.length < 2) return;

      const datas = pedidosCliente
        .map((p) => new Date(p.data_pedido))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      if (datas.length < 2) return;

      const intervalos = [];
      for (let i = 1; i < datas.length; i += 1) {
        intervalos.push(Math.floor((datas[i].getTime() - datas[i - 1].getTime()) / (1000 * 60 * 60 * 24)));
      }
      const cicloMedio = intervalos.reduce((sum, i) => sum + i, 0) / intervalos.length;
      if (!cicloMedio) return;

      const diasDesdeUltima = Math.floor(
        (now.getTime() - new Date(cliente.data_ultima_compra).getTime()) / (1000 * 60 * 60 * 24),
      );
      let probabilidade = Math.min(100, Math.max(0, (diasDesdeUltima / cicloMedio) * 100));
      if (cliente.classificacao_abc === 'A') probabilidade += 10;
      if (Number(cliente.score_pagamento) > 90) probabilidade += 5;
      if (diasDesdeUltima > cicloMedio * 1.5) probabilidade -= 20;
      probabilidade = Math.min(100, Math.max(0, probabilidade));

      if (probabilidade >= probabilidadeMinima) {
        previsoes.push({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          probabilidade: Number(probabilidade.toFixed(0)),
          ciclo_medio_dias: Number(cicloMedio.toFixed(0)),
          dias_desde_ultima: diasDesdeUltima,
          ticket_medio: Number(cliente.ticket_medio) || 0,
          produtos_preferidos: cliente.produtos_mais_comprados?.slice(0, 3) || [],
          temperatura: probabilidade > 80 ? 'Quente' : probabilidade > 60 ? 'Morno' : 'Frio',
        });
      }
    });

  previsoes.sort((a, b) => b.probabilidade - a.probabilidade);
  return stampIaSuggestion({
    previsoes,
    total: previsoes.length,
    fonte: 'previsao_recompra_local',
  });
};
