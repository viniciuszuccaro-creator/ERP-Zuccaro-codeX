import assert from 'node:assert/strict';

/** Approved integration/optional-contract hunks; every other V24 statement stays under the original invariant. */
export function clienteNavigationRemainder(source) {
  const changes = [
    ["import useClienteCadastroNavigation from './hooks/useClienteCadastroNavigation';\n", ''],
    ['  initialRecordId = undefined,\n  navigationReceipt = undefined,\n  reopenRequestId = undefined,\n', ''],
    ['  windowMode, entityName = undefined, columns = undefined,\n  pageSize: pageSizeProp = undefined,\n  statusColors: extraColors = undefined,', '  windowMode, entityName, columns,\n  pageSize: pageSizeProp,\n  statusColors: extraColors,'],
    ['  const { canCreate, canEdit, canDelete, hasPermission, isLoading: permissionsLoading } = usePermissions();', '  const { canCreate, canEdit, canDelete, hasPermission } = usePermissions();'],
    ['  const handleEditItem = useCallback(async function(item, navigationIsCurrent = () => true) {\n    if (!navigationIsCurrent()) return false;', '  const handleEditItem = useCallback(async function(item) {'],
    ['      return navigationIsCurrent() && isEditRequestCurrent({', '      return isEditRequestCurrent({'],
    ['      setEditError(classified.message);\n      setFormKey(function(k) { return k + 1; });\n      return true;', '      setEditError(classified.message);\n      setFormKey(function(k) { return k + 1; });'],
    ['      setEditError(failed.message);\n      return false;\n    } finally {', '      setEditError(failed.message);\n    } finally {'],
    [`  const initialNavigation = useClienteCadastroNavigation({
    entityName: ENTITY, id: initialRecordId, requestId: reopenRequestId, receipt: navigationReceipt,
    groupId, empresaId, canView: canViewCadastro, canEdit: canEditCadastro, permissionsLoading,
    openRecord: handleEditItem, closeRecord: handleCloseForm,
  });

`, ''],
    [`      {initialNavigation.error && (
        <div role="alert" className="flex items-center gap-2 text-sm text-red-700" data-action="cliente-cadastro-navigation-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{initialNavigation.error}</span>
          <button type="button" onClick={initialNavigation.retry} title="Tentar abrir cadastro novamente" aria-label="Tentar abrir cadastro novamente" className="h-8 w-8 shrink-0 flex items-center justify-center">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}
`, ''],
    // #591: documento/email/telefone variants + labels — peel back to golden e36231b3
    // (sem misturar CPF↔CNPJ nem Telefone↔Celular; parecer Bugbot + cadastro rico)
    [
      "  if (/^(nome|titulo|label|descricao)/i.test(String(field || ''))) {\n"
      + "    variants = variants.concat(['nome', 'descricao', 'titulo']);\n"
      + "  }\n"
      + "  // HTTP MASTER Cliente: documento unificado → coluna específica (sem misturar CPF↔CNPJ).\n"
      + "  const fieldKey = String(field || '');\n"
      + "  if (/^cpf$/i.test(fieldKey)) {\n"
      + "    variants = variants.concat(['documento', 'cpf_cnpj']);\n"
      + "  } else if (/^cnpj$/i.test(fieldKey)) {\n"
      + "    variants = variants.concat(['documento', 'cpf_cnpj']);\n"
      + "  } else if (/^(cpf_cnpj|documento)$/i.test(fieldKey)) {\n"
      + "    variants = variants.concat(['documento', 'cpf_cnpj', 'cnpj', 'cpf']);\n"
      + "  }\n"
      + "  // Telefone ≠ Celular ≠ WhatsApp — sem fallback cruzado que esconda ausência real.\n"
      + "  if (/^(telefone|fone)$/i.test(fieldKey)) {\n"
      + "    variants = variants.concat(['telefone', 'fone']);\n"
      + "  } else if (/^celular$/i.test(fieldKey)) {\n"
      + "    variants = variants.concat(['celular']);\n"
      + "  } else if (/^whatsapp$/i.test(fieldKey)) {\n"
      + "    variants = variants.concat(['whatsapp']);\n"
      + "  }\n"
      + "  if (/^(email|e_mail)$/i.test(String(field || ''))) {\n"
      + "    variants = variants.concat(['email']);\n"
      + "  }\n"
      + "  return variants;\n",
      "  if (/^(nome|titulo|label|descricao)/i.test(String(field || ''))) {\n"
      + "    variants = variants.concat(['nome', 'descricao', 'titulo']);\n"
      + "  }\n"
      + "  return variants;\n",
    ],
    [
      '      ativo: "Ativo",\n'
      + '      documento: "CPF/CNPJ",\n'
      + '      cpf: "CPF",\n'
      + '      cnpj: "CNPJ",\n'
      + '      email: "E-mail",\n'
      + '      telefone: "Telefone",\n'
      + '      celular: "Celular",\n'
      + '      razao_social: "Razão social",\n',
      '      ativo: "Ativo",\n'
      + '      razao_social: "Razão social",\n',
    ],
  ];
  let result = source.replace(/\r\n/g, '\n');
  for (const [before, after] of changes) {
    assert.equal(result.split(before).length, 2, 'Approved integration hunk must occur exactly once');
    result = result.replace(before, after);
  }
  return result;
}
