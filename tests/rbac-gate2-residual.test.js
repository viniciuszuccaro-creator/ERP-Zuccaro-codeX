import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildSensitiveGuardRequest } from '../src/components/lib/sensitiveActionGuardPolicy.js';

test('explicit group/empresa context beats localStorage in sensitive guard', () => {
  const request = buildSensitiveGuardRequest({
    permission: 'financeiro.caixa.baixa-manual',
    groupId: 'grupo-real',
    empresaId: 'empresa-real',
    scopeType: 'empresa',
    storage: {
      getItem: (key) => ({
        contexto_atual: 'grupo',
        group_atual_id: 'grupo-falso',
        empresa_atual_id: 'empresa-falsa',
      }[key] || null),
    },
  });
  assert.equal(request.valid, true);
  assert.equal(request.payload.group_id, 'grupo-real');
  assert.equal(request.payload.empresa_id, 'empresa-real');
  assert.equal(request.payload.scope_type, 'company');
});

test('P0.2 RBAC residual: admin bypass e fail-open removidos', async () => {
  const guard = await readFile(new URL('../base44/functions/_lib/guard/entry.ts', import.meta.url), 'utf8');
  const aprov = await readFile(new URL('../base44/functions/solicitacoesAprovacao/entry.ts', import.meta.url), 'utf8');
  const acoes = await readFile(new URL('../src/components/AcoesRapidasGlobal.jsx', import.meta.url), 'utf8');
  const central = await readFile(new URL('../src/components/comercial/CentralAprovacoesManager.jsx', import.meta.url), 'utf8');
  const desc = await readFile(new URL('../src/components/comercial/AprovacaoDescontos.jsx', import.meta.url), 'utf8');
  const descMgr = await readFile(new URL('../src/components/comercial/AprovacaoDescontosManager.jsx', import.meta.url), 'utf8');
  const permEmp = await readFile(new URL('../src/components/lib/usePermissoesEmpresa.jsx', import.meta.url), 'utf8');
  const local = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const button = await readFile(new URL('../src/components/ui/button.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(guard, /userRole === 'admin' return true/);
  assert.doesNotMatch(guard, /emitir: 'criar'/);
  assert.match(guard, /emitir\/enviar\/executar permanecem granulares/);
  assert.doesNotMatch(aprov, /user\?\.role === 'admin' return true/);
  assert.match(aprov, /perfil_acesso_id/);
  assert.match(acoes, /if \(loadingPerms \|\| !user\) return false/);
  assert.doesNotMatch(acoes, /user\?\.role === 'admin'/);
  assert.doesNotMatch(central, /user\?\.role === "admin"/);
  assert.doesNotMatch(central, /user\?\.role === "gerente"/);
  assert.doesNotMatch(desc, /user\?\.role === "admin"/);
  assert.doesNotMatch(descMgr, /user\?\.role === "gerente"/);
  assert.doesNotMatch(permEmp, /return 'Aprovar'/);
  assert.doesNotMatch(permEmp, /acesso_consolidado && acao === 'visualizar'/);
  assert.match(permEmp, /Fail-closed: role admin/);
  // isAdmin flag informativa no retorno ainda pode existir; autorizacao usa temPermissao
  assert.match(local, /secao-negada/);
  assert.doesNotMatch(local, /modulo-fallback/);
  assert.match(button, /__groupId/);
});
