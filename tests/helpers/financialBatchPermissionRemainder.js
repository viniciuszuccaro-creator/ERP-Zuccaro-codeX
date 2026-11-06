import assert from 'node:assert/strict';

export const financialBatchHunks = {};
for (const [kind, entity, message] of [['Pagar', 'ContaPagar', 'pagamento multiplo'], ['Receber', 'ContaReceber', 'baixa multipla']]) {
  const file = `src/components/financeiro/Contas${kind}Tab.jsx`;
  financialBatchHunks[file] = [
    ['  const { hasPermission, isLoading: permissionsLoading } = usePermissions();', '  const { hasPermission } = usePermissions();'],
    [`  const podeBaixarMultipla${kind} = !permissionsLoading && podeBaixar${kind} && hasPermission('Financeiro','${entity}','baixar_multiplos');\n`, ''],
    [`      if (!podeBaixarMultipla${kind}) throw new Error('Sem permissao para ${message}.');`, `      if (!podeBaixar${kind}) throw new Error('Sem permissao para ${message}.');`],
    [`    if (!podeBaixarMultipla${kind}) {\n      toast({ title: '⛔ Sem permissão para baixa múltipla'`, `    if (!podeBaixar${kind}) {\n      toast({ title: '⛔ Sem permissão para baixa múltipla'`],
    [`    if (!contaAtual && !podeBaixarMultipla${kind}) {\n      toast({ title: 'Sem permissao para baixa multipla', variant: 'destructive' });\n      return;\n    }\n`, ''],
    [`(!contaAtual && !podeBaixarMultipla${kind}) || `, ''],
    [`data-action={contaAtual ? '${entity}.baixar' : '${entity}.baixar_multiplos'} data-permission={contaAtual ? 'Financeiro.${entity}.baixar' : 'Financeiro.${entity}.baixar_multiplos'}`, `data-action="${entity}.baixar" data-permission="Financeiro.${entity}.baixar"`],
  ];
}
for (const [kind, slug, legacy] of [['Pagar', 'pagar', 'pagar'], ['Receber', 'receber', 'receber']]) {
  financialBatchHunks[`src/components/financeiro/contas-${slug}/Filtros${kind}.jsx`] = [
    [`module="Financeiro" section="Conta${kind}" action="exportar"`, `permission="financeiro_${legacy}_exportar"`],
    [`module="Financeiro" section="Conta${kind}" action="baixar_multiplos"`, `permission="financeiro_${legacy}_baixar_multiplos"`],
    ...(kind === 'Receber' ? [[`module="Financeiro" section="ContaReceber" action="criar"`, `permission="financeiro_receber_criar"`]] : []),
  ];
}
financialBatchHunks['src/components/fiscal/RelatorioDRE.jsx'] = [[
  "new Date(Number(periodo.split('-')[0]), Number(periodo.split('-')[1]), 0)",
  "new Date(periodo.split('-')[0], periodo.split('-')[1], 0)",
]];
export function financialBatchPermissionRemainder(file, text) {
  if (!financialBatchHunks[file]) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [after, before] of financialBatchHunks[file]) {
    assert.equal(source.split(after).length, 2, file + ': one exact authorized batch/date hunk');
    source = source.replace(after, before);
  }
  if (file.includes('/Filtros') || file === 'src/components/fiscal/RelatorioDRE.jsx') {
    assert.ok(source.endsWith('\n') && !source.endsWith('\n\n'), 'one added EOF newline');
    source = source.slice(0, -1);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
