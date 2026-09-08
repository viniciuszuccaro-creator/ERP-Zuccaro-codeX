import { assertChecklistVirada } from "./viradaProducaoPolicy.js";

const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const strip = (value) => firstText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const PAPEIS_PILOTO = [
  'administrador',
  'vendedor',
  'financeiro',
  'faturamento',
  'estoque',
  'producao',
];

export const CENARIOS_PILOTO = [
  'venda_a_vista',
  'venda_a_prazo',
  'pedido_com_producao',
  'pedido_com_entrega',
  'faturamento_parcial',
  'recebimento',
  'compra_entrada',
  'pagamento',
  'devolucao_ocorrencia',
  'cancelamento_controlado',
];

export const CENARIO_PILOTO_LABELS = {
  venda_a_vista: 'Venda a vista',
  venda_a_prazo: 'Venda a prazo',
  pedido_com_producao: 'Pedido com producao',
  pedido_com_entrega: 'Pedido com entrega',
  faturamento_parcial: 'Faturamento parcial',
  recebimento: 'Recebimento',
  compra_entrada: 'Compra / entrada',
  pagamento: 'Pagamento',
  devolucao_ocorrencia: 'Devolucao / ocorrencia',
  cancelamento_controlado: 'Cancelamento controlado',
};

export const MODO_OPERACAO_CHAVE = 'modo_operacao';
export const PILOTO_CENARIOS_CHAVE = 'piloto_cenarios';

export const normalizePapelPiloto = (value) => {
  const raw = strip(value);
  if (raw === 'admin' || raw === 'administrador') return 'administrador';
  if (raw === 'vendedor' || raw === 'comercial') return 'vendedor';
  if (raw === 'financeiro') return 'financeiro';
  if (raw === 'faturamento' || raw === 'fiscal') return 'faturamento';
  if (raw === 'estoque' || raw === 'expedicao' || raw === 'estoque/expedicao') return 'estoque';
  if (raw === 'producao') return 'producao';
  return null;
};

export const isUsuarioPiloto = (user = {}) => (
  user?.usuario_piloto === true
  && Boolean(normalizePapelPiloto(user.papel_piloto))
  && user?.ativo !== false
);

export const resolveModoOperacao = (configs = []) => {
  const row = (Array.isArray(configs) ? configs : []).find((item) => firstText(item.chave) === MODO_OPERACAO_CHAVE);
  const raw = strip(row?.valor || row?.valor_texto || row?.valor_string);
  if (raw.startsWith('prod')) return 'producao';
  return 'piloto';
};

export const isModoPiloto = (modo) => resolveModoOperacao([{ chave: MODO_OPERACAO_CHAVE, valor: modo }]) === 'piloto';

export const stampUsuarioPiloto = (record = {}, { piloto = false, papel } = {}) => {
  if (!piloto) {
    return { ...record, usuario_piloto: false, papel_piloto: null };
  }
  const papelPiloto = normalizePapelPiloto(papel || record.papel_piloto);
  if (!papelPiloto) {
    throw new Error('Papel piloto obrigatorio (administrador, vendedor, financeiro, faturamento, estoque ou producao).');
  }
  return { ...record, usuario_piloto: true, papel_piloto: papelPiloto };
};

export const applyUsuarioPilotoOnWrite = (record = {}) => {
  if (record.usuario_piloto !== true && !firstText(record.papel_piloto)) return record;
  return stampUsuarioPiloto(record, { piloto: record.usuario_piloto === true, papel: record.papel_piloto });
};

export const papeisPilotoCobertos = (users = []) => {
  const cobertos = new Set();
  (Array.isArray(users) ? users : []).forEach((user) => {
    if (!isUsuarioPiloto(user)) return;
    cobertos.add(normalizePapelPiloto(user.papel_piloto));
  });
  return PAPEIS_PILOTO.filter((papel) => cobertos.has(papel));
};

export const evaluateCenariosPiloto = (executados = []) => {
  const ok = new Set(
    (Array.isArray(executados) ? executados : [])
      .filter((item) => item && (item.ok === true || item.sucesso === true || item.status === 'ok'))
      .map((item) => strip(item.id || item.cenario || item.codigo)),
  );
  const faltando = CENARIOS_PILOTO.filter((cenario) => !ok.has(cenario));
  return { ok: faltando.length === 0, faltando };
};

export const normalizeCenarioPiloto = (value) => {
  const raw = strip(value);
  return CENARIOS_PILOTO.includes(raw) ? raw : null;
};

export const applyPilotoCenariosOnWrite = ({ record = {}, user = null } = {}) => {
  if (firstText(record.chave) !== PILOTO_CENARIOS_CHAVE) return record;
  const incoming = Array.isArray(record.valor_json) ? record.valor_json : [];
  const normalized = [];
  const seen = new Set();
  incoming.forEach((item) => {
    const id = normalizeCenarioPiloto(
      typeof item === 'string' ? item : (item?.id || item?.cenario || item?.codigo),
    );
    if (!id) {
      throw new Error(`Cenario piloto invalido: ${typeof item === 'string' ? item : (item?.id || JSON.stringify(item))}`);
    }
    if (seen.has(id)) return;
    seen.add(id);
    const ok = item === id
      ? true
      : (item?.ok === true || item?.sucesso === true || item?.status === 'ok');
    normalized.push({
      id,
      ok,
      sucesso: ok,
      status: ok ? 'ok' : 'pendente',
      marcado_por: firstText(item?.marcado_por, user?.email, user?.full_name) || null,
      marcado_em: firstText(item?.marcado_em) || (ok ? new Date().toISOString() : null),
    });
  });
  const concluidos = normalized.filter((item) => item.ok).length;
  return {
    ...record,
    chave: PILOTO_CENARIOS_CHAVE,
    categoria: record.categoria || 'Sistema',
    valor: `${concluidos}/${CENARIOS_PILOTO.length}`,
    valor_texto: `${concluidos}/${CENARIOS_PILOTO.length}`,
    valor_json: normalized,
  };
};

export const evaluateHomologacaoPiloto = ({ users = [], cenariosExecutados = [] } = {}) => {
  const papeis = papeisPilotoCobertos(users);
  const cenarios = evaluateCenariosPiloto(cenariosExecutados);
  return {
    ok: papeis.length === PAPEIS_PILOTO.length && cenarios.ok,
    papeis,
    papeisFaltando: PAPEIS_PILOTO.filter((papel) => !papeis.includes(papel)),
    cenarios,
  };
};

export const assertOperacaoPiloto = ({ user, modoOperacao = 'piloto', acao = 'operacao_critica' } = {}) => {
  if (!isModoPiloto(modoOperacao)) return { modo: 'producao', permitido: true };
  if (!isUsuarioPiloto(user)) {
    throw new Error(`Operacao ${acao} no piloto exige usuario piloto designado.`);
  }
  return { modo: 'piloto', permitido: true, papel: normalizePapelPiloto(user.papel_piloto) };
};

export const assertViradaProducao = ({
  users = [],
  cenariosExecutados = [],
  incidentesCriticosAbertos = [],
  backups = [],
  configBackup = {},
  configs = [],
} = {}) => {
  const cobertos = papeisPilotoCobertos(users);
  if (cobertos.length < PAPEIS_PILOTO.length) {
    throw new Error('Virada para producao exige os 6 papeis piloto designados.');
  }
  const cenarios = evaluateCenariosPiloto(cenariosExecutados);
  if (!cenarios.ok) {
    throw new Error('Virada para producao exige os cenarios piloto reconciliados.');
  }
  const abertos = (Array.isArray(incidentesCriticosAbertos) ? incidentesCriticosAbertos : [])
    .filter((item) => item && item.aberto !== false && (item.severidade === 'P0' || item.severidade === 'critico'));
  if (abertos.length > 0) {
    throw new Error('Virada para producao bloqueada enquanto houver erro critico aberto.');
  }
  assertChecklistVirada({ backups, configBackup, configs });
  return { permitido: true, modo: 'producao' };
};

export const applyModoOperacaoOnWrite = ({
  record = {},
  users = [],
  cenariosExecutados = [],
  incidentesCriticosAbertos = [],
  backups = [],
  configBackup = {},
  configs = [],
} = {}) => {
  if (firstText(record.chave) !== MODO_OPERACAO_CHAVE) return record;
  const modo = resolveModoOperacao([record]);
  if (modo === 'producao') {
    assertViradaProducao({
      users,
      cenariosExecutados,
      incidentesCriticosAbertos,
      backups,
      configBackup,
      configs,
    });
  }
  return { ...record, chave: MODO_OPERACAO_CHAVE, valor: modo, valor_texto: modo, categoria: record.categoria || 'Sistema' };
};
