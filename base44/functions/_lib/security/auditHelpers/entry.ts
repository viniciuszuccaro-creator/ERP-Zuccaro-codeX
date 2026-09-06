// Helpers de auditoria e segurança

export function getModuleForEntity(entidade) {
  const moduloMap = {
    Cliente: 'CRM', Oportunidade: 'CRM', Interacao: 'CRM',
    Pedido: 'Comercial', Comissao: 'Comercial', NotaFiscal: 'Fiscal',
    Produto: 'Estoque', MovimentacaoEstoque: 'Estoque',
    ContaPagar: 'Financeiro', ContaReceber: 'Financeiro',
    Entrega: 'Expedição', Romaneio: 'Expedição',
    AuditoriaIA: 'IA', ChatbotInteracao: 'Chatbot',
  };
  return moduloMap[entidade] || 'Sistema';
}

export function safeTrimPayload(obj, maxKeys = 200) {
  try {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitive = /(token|senha|password|secret|api[_-]?key|authorization|certificado|private|webhook[_-]?url)/i;
    const keys = Object.keys(obj);
    const trimmed = {};
    const limit = Math.min(keys.length, maxKeys);
    for (let i = 0; i < limit; i++) {
      const k = keys[i];
      trimmed[k] = sensitive.test(k) ? { protegido: true } : obj[k];
    }
    if (keys.length > maxKeys) trimmed.__trimmed__ = { kept: maxKeys, total: keys.length };
    return trimmed;
  } catch (_) {
    return obj;
  }
}