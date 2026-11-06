import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveNotificationCenterKpiState,
  isNotificationCenterScopeCurrent,
  filterNotificacoesVisiveis,
  countNotificacoesNaoLidas,
  buildNotificationCenterQueryKey,
} from '../src/components/notificationCenterScope.js';

test('NotificationCenter usa filter/update InContext sem entities unscoped', () => {
  const src = readFileSync('src/components/NotificationCenter.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Notificacao'/);
  assert.match(src, /updateInContext\(\s*'Notificacao'/);
  assert.match(src, /NOTIFICATION_CENTER_STALE_SCOPE/);
  assert.match(src, /erro ≠ badge 0/);
  assert.doesNotMatch(src, /entities\.Notificacao\.(filter|update)\(/);
  assert.doesNotMatch(src, /base44\.auth\.me\(/);
  assert.doesNotMatch(src, /data:\s*notificacoes\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI, filtro destinatário e badge', () => {
  assert.equal(resolveNotificationCenterKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveNotificationCenterKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  const vis = filterNotificacoesVisiveis([
    { id: 1, arquivada: false, destinatario_email: 'a@x.com', lida: false },
    { id: 2, arquivada: true, destinatario_email: '', lida: false },
    { id: 3, arquivada: false, destinatario_email: '', lida: true },
    { id: 4, arquivada: false, destinatario_email: 'b@x.com', lida: false },
  ], 'a@x.com');
  assert.deepEqual(vis.map((n) => n.id), [1, 3]);
  assert.equal(countNotificacoesNaoLidas(vis), 1);
  assert.equal(isNotificationCenterScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildNotificationCenterQueryKey({ groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's' }),
    ['notificacoes', 'g', 'e', 'a', 's'],
  );
});
