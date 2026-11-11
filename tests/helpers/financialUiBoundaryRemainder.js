import assert from 'node:assert/strict';
import {bankManualReconciliationRemainder} from './bankManualReconciliationRemainder.js';

const prefix = 'src/components/financeiro/';
const checkbox = setter => [`onCheckedChange={(checked) => ${setter}(checked === true)}`, `onCheckedChange={${setter}}`];
const invalidation = key => [`queryClient.invalidateQueries({ queryKey: [${key}] });`, `queryClient.invalidateQueries([${key}]);`];
export const financialUiBoundaryHunks = {
  [prefix + 'CaixaPDVCompleto.jsx']: ['setEmitirRecibo', 'setEmitirNFe', 'setEmitirBoleto'].map(checkbox),
  [prefix + 'DuplicarMesAnterior.jsx']: [checkbox('setIncluirRecorrentes')],
  [prefix + 'ConciliacaoBancaria.jsx']: ["'pagamentos-omnichannel-pendentes'", "'caixa-ordens-liquidadas'"].map(invalidation),
  [prefix + 'ConciliacaoBancariaTab.jsx']: [invalidation('"conciliacao-bancaria"')],
  [prefix + 'SimularPagamentoModal.jsx']: ["'contasReceber'", "'pagamentos-omnichannel'", "'caixa-ordens-liquidacao'", "'historico-cliente'"].map(invalidation),
  [prefix + 'caixa-central/OrdensLiquidacaoPendentes.jsx']: [[
    '    /** @param {{ordemId: string | number, dados: {forma_pagamento: string, observacoes: string, usuario_id?: string | number}}} command */\n    mutationFn: async ({ ordemId, dados }) => {',
    '    mutationFn: async ({ ordemId, dados }) => {',
  ]],
  [prefix + 'CartoesACompensar.jsx']: [[
    '    /** @param {{cartao: {id?: string | number, valor_liquido?: string | number | null, group_id?: string | null, grupo_id?: string | null, empresa_id?: string | null}}} command */\n    mutationFn: async ({ cartao }) => {',
    '    mutationFn: async ({ cartao }) => {',
  ]],
};
const appendedLf = {
  [prefix + 'DuplicarMesAnterior.jsx']: '    </Dialog>\n  );\n}\n',
  [prefix + 'ConciliacaoBancaria.jsx']: '  return content;\n}\n',
  [prefix + 'SimularPagamentoModal.jsx']: '    </div>\n  );\n}\n',
};
export function financialUiBoundaryRemainder(file, text) {
  text=bankManualReconciliationRemainder(file,text,false);
  const hunks = financialUiBoundaryHunks[file];
  if (!hunks) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [current, previous] of hunks) {
    assert.equal(source.split(current).length - 1, 1, `${file}: exact financial UI hunk`);
    source = source.replace(current, previous);
  }
  if (appendedLf[file]) {
    assert.ok(source.endsWith(appendedLf[file]), `${file}: exact anchored final LF`);
    source = source.slice(0, -1);
  }
  return source;
}
