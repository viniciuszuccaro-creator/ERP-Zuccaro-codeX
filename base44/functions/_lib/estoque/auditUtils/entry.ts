
import { audit } from '../guard.js';

// Auditoria padronizada para operações de Estoque
export async function stockAudit(base44, user, { acao, entidade, registro_id, descricao, empresa_id = null, group_id = null, empresa_nome = null, dados_novos = null, duracao_ms = null }, meta = null) {
  try {
    const merged = dados_novos && typeof dados_novos === 'object' ? { ...dados_novos } : {};
    if (meta) merged._meta = meta; // garante captura mesmo se audit ignorar 4º parâmetro
    await audit(base44, user || { full_name: 'Sistema' }, {
      acao,
      modulo: 'Estoque',
      entidade,
      registro_id,
      descricao,
      empresa_id,
      group_id,
      empresa_nome,
      dados_novos: Object.keys(merged).length ? merged : null,
      duracao_ms,
    }, meta);
  } catch (_) {
    // auditoria não deve quebrar fluxo principal
  }
}
