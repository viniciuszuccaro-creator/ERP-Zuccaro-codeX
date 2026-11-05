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
// Delta autorizado: ContasReceber Empresa/ConfigCobranca via filterInContext (#529).
financialBatchHunks['src/components/financeiro/ContasReceberTab.jsx'].push(
  [
    '  const { createInContext, updateInContext, filterInContext, empresaAtual, grupoAtual } = useContextoVisual();\n',
    '  const { createInContext, updateInContext, empresaAtual, grupoAtual } = useContextoVisual();\n',
  ],
  [
    "  // Escopo multiempresa: Empresa/ConfiguracaoCobrancaEmpresa via filterInContext (não list unscoped).\n  const { data: empresasQuery = [], isError: isErrorEmpresasCobranca } = useQuery({\n    queryKey: ['empresas', scopeKey],\n    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 500),\n    enabled: contextoValido,\n  });\n\n  const { data: configsCobranca = [], isError: isErrorConfigsCobranca } = useQuery({\n    queryKey: ['configs-cobranca', scopeKey],\n    queryFn: () => filterInContext('ConfiguracaoCobrancaEmpresa', {}, '-created_date', 500),\n    enabled: contextoValido,\n  });\n\n  const empresasData = empresas.length > 0 ? empresas : empresasQuery;\n  const cobrancaMastersIndisponiveis = isErrorEmpresasCobranca || isErrorConfigsCobranca;\n",
    "  const { data: empresasQuery = [] } = useQuery({\n    queryKey: ['empresas', scopeKey],\n    queryFn: () => base44.entities.Empresa.list(),\n    enabled: contextoValido,\n  });\n\n  const { data: configsCobranca = [] } = useQuery({\n    queryKey: ['configs-cobranca', scopeKey],\n    queryFn: () => base44.entities.ConfiguracaoCobrancaEmpresa.list(),\n    enabled: contextoValido,\n  });\n\n  const empresasData = empresas.length > 0 ? empresas : empresasQuery;\n",
  ],
  [
    "        onGerarCobranca={(conta) => {\n          if (!contextoValido) {\n            toast({ title: 'Selecione grupo ou empresa antes de gerar cobrança', variant: 'destructive' });\n            return;\n          }\n          if (cobrancaMastersIndisponiveis) {\n            toast({ title: 'Configuração de cobrança indisponível (erro ≠ zero)', variant: 'destructive' });\n            return;\n          }\n          setContaParaCobranca(conta);\n          setGerarCobrancaDialogOpen(true);\n        }}\n",
    "        onGerarCobranca={(conta) => {\n          setContaParaCobranca(conta);\n          setGerarCobrancaDialogOpen(true);\n        }}\n",
  ],
);
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
