export function isAssinaturaModalScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function assertAssinaturaModalContext(groupId, empresaId) {
  if (!groupId && !empresaId) {
    throw Object.assign(new Error('ASSINATURA_MODAL_SCOPE_BLOCKED'), {
      code: 'ASSINATURA_MODAL_SCOPE_BLOCKED',
    });
  }
}

export function assertAssinaturaModalDocumento(documento, tipo) {
  if (!documento?.id) {
    throw Object.assign(new Error('ASSINATURA_MODAL_DOCUMENTO_REQUIRED'), {
      code: 'ASSINATURA_MODAL_DOCUMENTO_REQUIRED',
    });
  }
  if (tipo !== 'contrato' && tipo !== 'pedido') {
    throw Object.assign(new Error('ASSINATURA_MODAL_TIPO_INVALIDO'), {
      code: 'ASSINATURA_MODAL_TIPO_INVALIDO',
    });
  }
  return documento.id;
}

export function buildAssinaturaModalCampoContrato(documento, assinatura) {
  return {
    assinado: true,
    data_assinatura: new Date().toISOString().split('T')[0],
    assinatura_digital: assinatura,
    status: documento?.status === 'Aguardando Assinatura' ? 'Vigente' : documento?.status,
  };
}

export function buildAssinaturaModalCampoPedido(assinatura) {
  return {
    assinado_cliente: true,
    data_assinatura_cliente: new Date().toISOString(),
    assinatura_cliente: assinatura,
  };
}

export function resolveAssinaturaModalEntity(tipo) {
  return tipo === 'contrato' ? 'Contrato' : 'Pedido';
}
