import { computeInventoryMovements } from './computeInventoryMovements.js';
import { persistInventoryMovements } from './persistInventoryMovements.js';
import { finalizeInventoryPatch } from './finalizeInventoryPatch.js';
import { audit } from '../guard.js';

function buildInventoryAdjustmentAuditPayload(inv = {}, movimentos = []) {
  const list = Array.isArray(movimentos) ? movimentos : [];
  return {
    inventario_id: inv?.id || null,
    empresa_id: inv?.empresa_id || null,
    group_id: inv?.group_id || inv?.grupo_id || null,
    quantidade_movimentos: list.length,
    produtos_ids: list.filter(Boolean).slice(0, 50),
  };
}
// Handler pequeno e reutilizável para aplicar ajustes de inventário
export async function handleApplyInventoryAdjustments(base44, ctx, inv, user) {
  const movimentoRecords = computeInventoryMovements(inv, user);
  if (!Array.isArray(movimentoRecords) || movimentoRecords.length === 0) {
    return { movimentos: [], movimentos_count: 0, skipped: true };
  }

  const movimentos = await persistInventoryMovements(base44, movimentoRecords);

  await base44.asServiceRole.entities.Inventario.update(inv.id, finalizeInventoryPatch(user));

  await audit(base44, user, {
    acao: 'Edicao',
    modulo: 'Estoque',
    entidade: 'Inventario',
    registro_id: inv.id,
    empresa_id: inv?.empresa_id || null,
    group_id: inv?.group_id || inv?.grupo_id || null,
    descricao: 'Aplicação de ajustes de inventário',
    dados_novos: buildInventoryAdjustmentAuditPayload(inv, movimentos)
  });

  return { movimentos, movimentos_count: movimentos.length, skipped: false };
}