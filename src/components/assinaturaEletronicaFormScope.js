export function isAssinaturaFormScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function assertAssinaturaFormContext(groupId, empresaId) {
  if (!groupId && !empresaId) {
    throw Object.assign(new Error('ASSINATURA_FORM_SCOPE_BLOCKED'), {
      code: 'ASSINATURA_FORM_SCOPE_BLOCKED',
    });
  }
}

export function assertAssinaturaFormDocumento(documento, tipo) {
  if (!documento?.id) {
    throw Object.assign(new Error('ASSINATURA_FORM_DOCUMENTO_REQUIRED'), {
      code: 'ASSINATURA_FORM_DOCUMENTO_REQUIRED',
    });
  }
  if (tipo !== 'contrato' && tipo !== 'pedido') {
    throw Object.assign(new Error('ASSINATURA_FORM_TIPO_INVALIDO'), {
      code: 'ASSINATURA_FORM_TIPO_INVALIDO',
    });
  }
  return documento.id;
}

export function buildAssinaturaFormCampoContrato(documento, assinatura) {
  return {
    assinado: true,
    data_assinatura: new Date().toISOString().split('T')[0],
    assinatura_digital: assinatura,
    status: documento?.status === 'Aguardando Assinatura' ? 'Vigente' : documento?.status,
  };
}

export function buildAssinaturaFormCampoPedido(assinatura) {
  return {
    assinado_cliente: true,
    data_assinatura_cliente: new Date().toISOString(),
    assinatura_cliente: assinatura,
  };
}

export function resolveAssinaturaFormEntity(tipo) {
  return tipo === 'contrato' ? 'Contrato' : 'Pedido';
}
