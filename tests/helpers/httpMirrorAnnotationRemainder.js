import assert from 'node:assert/strict';

export const mirrorInputBefore = ' * @param {{ groupId: string, empresaId?: string | null }} input';
export const mirrorInputAfter = ` * @param {{ groupId?: string, empresaId?: string | null, groupName?: string | null,
 * empresas?: Array<{id: string, group_id?: string, razao_social?: string, nome_fantasia?: string | null, cnpj?: string | null, status?: string}>,
 * perfilAcessoId?: string | null, permissoes?: Record<string, unknown> | null,
 * perfilNome?: string | null }} input`;

export function httpMirrorAnnotationRemainder(source) {
  assert.equal(source.split(mirrorInputAfter).length, 2, 'Exactly one complete mirror input annotation');
  return source.replace(mirrorInputAfter, mirrorInputBefore);
}
