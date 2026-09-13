import { mapDeliveryStatus, mapTimelineEvent, normalized } from './contract.ts';
import { recordWorkId } from '../siteCpaPortal/contract.ts';

const text = (value) => String(value ?? '').trim();
const first = (...values) => values.find((value) => text(value)) ?? null;
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};

const maskStreet = (value) => {
  const street = text(value);
  if (!street) return null;
  if (street.length <= 4) return `${street.slice(0, 1)}***`;
  return `${street.slice(0, Math.min(12, Math.ceil(street.length / 2)))}***`;
};

export const publicAddressSummary = (delivery = {}) => {
  const address = delivery.endereco_entrega_completo || delivery.endereco_entrega || {};
  if (!address || typeof address !== 'object') return null;
  const summary = {
    streetMasked: maskStreet(address.logradouro || address.endereco),
    bairro: text(address.bairro) || null,
    cidade: text(address.cidade) || null,
    estado: text(address.estado || address.uf).toUpperCase() || null,
  };
  return Object.values(summary).some(Boolean) ? summary : null;
};

const deliveryItems = (delivery = {}, order = {}) => {
  const source = delivery.itens || delivery.itens_entrega || delivery.itens_separados
    || order.itens || order.itens_revenda || order.itens_producao || [];
  return (Array.isArray(source) ? source : []).slice(0, 500).map((item) => {
    const ordered = numberOrNull(item.quantidade_pedida ?? item.quantidade_solicitada ?? item.quantidade);
    const planned = numberOrNull(item.quantidade_planejada ?? item.quantidade_separada ?? ordered);
    let delivered = numberOrNull(item.quantidade_entregue ?? item.quantidade_realizada);
    const status = mapDeliveryStatus(delivery);
    if (delivered === null && ['DELIVERED', 'PICKED_UP'].includes(status)) delivered = planned;
    const remaining = planned !== null && delivered !== null ? Math.max(0, planned - delivered) : null;
    return {
      erpProductId: first(item.produto_id, item.erpProductId),
      name: first(item.nome_produto, item.produto_nome, item.descricao, item.nome),
      quantityOrdered: ordered,
      quantityPlanned: planned,
      quantityDelivered: delivered,
      quantityRemaining: remaining,
      commercialUnit: first(item.unidade, item.unidade_comercial, item.commercialUnit),
    };
  });
};

const publicOccurrenceType = (value) => {
  const type = normalized(value);
  if (type.includes('AUSENT')) return 'CLIENTE_AUSENTE';
  if (type.includes('ENDERE')) return 'ENDERECO_NAO_LOCALIZADO';
  if (type.includes('RECUS')) return 'RECUSA';
  if (type.includes('FALTA')) return 'FALTA_DE_MERCADORIA';
  if (type.includes('DIVERG')) return 'DIVERGENCIA';
  if (type.includes('AVARIA') || type.includes('DANO')) return 'AVARIA';
  if (type.includes('REAGEND') || type.includes('ATRAS')) return 'REAGENDAMENTO';
  return 'OUTRO';
};

export const publicOccurrences = (delivery = {}) => {
  const occurrences = Array.isArray(delivery.ocorrencias) ? delivery.ocorrencias : [];
  const result = occurrences.slice(0, 100).map((item, index) => ({
    occurrenceId: text(item.id) || `${delivery.id}:occurrence:${index + 1}`,
    type: publicOccurrenceType(item.tipo || item.status),
    createdAt: first(item.data_hora, item.created_date),
    publicNote: first(item.descricao_publica, item.mensagem_cliente, item.observacao_publica),
  }));
  const frustrated = delivery.entrega_frustrada || {};
  if (frustrated.reagendamento || frustrated.nova_data) {
    result.push({
      occurrenceId: `${delivery.id}:reschedule`,
      type: 'REAGENDAMENTO',
      createdAt: first(frustrated.reagendamento, frustrated.nova_data, delivery.updated_date),
      publicNote: first(frustrated.mensagem_cliente, frustrated.observacao_publica),
    });
  }
  return result.filter((item) => item.createdAt).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
};

const safePrivateUri = (value, extensions) => {
  const uri = text(value);
  if (!uri || uri.length > 500 || uri.includes('..') || uri.includes('\\')
    || /^(?:https?|file|data):/i.test(uri) || !/^[A-Za-z0-9._/-]+$/.test(uri)) return null;
  return extensions.some((extension) => uri.toLowerCase().endsWith(extension)) ? uri : null;
};

const pushProof = (proofs, delivery, suffix, type, uri, createdAt, metadata = {}) => {
  const fileUri = safePrivateUri(uri, type === 'DELIVERY_PHOTO' ? ['.jpg', '.jpeg', '.png', '.webp'] : ['.pdf', '.png', '.jpg', '.jpeg']);
  if (!fileUri) return;
  proofs.push({
    proofId: `${delivery.id}:${suffix}`,
    type,
    fileUri,
    createdAt: createdAt || delivery.updated_date || delivery.created_date || null,
    metadata,
  });
};

const maskReceiverDocument = (value) => {
  const digits = text(value).replace(/\D/g, '');
  if (digits.length < 2) return null;
  return `***.***.***-${digits.slice(-2)}`;
};

export const deliveryProofDescriptors = (delivery = {}) => {
  const proof = delivery.comprovante_entrega || {};
  const proofs = [];
  const createdAt = first(proof.data_hora_recebimento, delivery.data_entrega, delivery.updated_date);
  const metadata = {
    receiverName: text(proof.nome_recebedor).slice(0, 120) || null,
    receiverDocumentMasked: maskReceiverDocument(proof.documento_recebedor),
  };
  pushProof(proofs, delivery, 'signature', 'SIGNATURE',
    first(proof.assinatura_file_uri, proof.assinatura_digital_file_uri), createdAt, metadata);
  pushProof(proofs, delivery, 'photo', 'DELIVERY_PHOTO',
    first(proof.foto_file_uri, proof.foto_comprovante_file_uri, proof.foto_comprovante), createdAt, metadata);
  pushProof(proofs, delivery, 'romaneio', 'SIGNED_ROMANEIO',
    first(proof.romaneio_assinado_file_uri, delivery.romaneio_assinado_file_uri), createdAt, metadata);
  (Array.isArray(delivery.ocorrencias) ? delivery.ocorrencias : []).slice(0, 100).forEach((occurrence, index) => {
    pushProof(proofs, delivery, `occurrence-${index + 1}`, 'DELIVERY_PHOTO',
      first(occurrence.foto_file_uri, occurrence.foto_ocorrencia_file_uri),
      first(occurrence.data_hora, occurrence.created_date), { occurrence: true });
  });
  return proofs;
};

const publicDriverName = (value) => {
  const parts = text(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0].slice(0, 40) : `${parts[0].slice(0, 30)} ${parts.at(-1).slice(0, 1)}.`;
};

export const publicDelivery = (delivery = {}, order = {}, detailed = false) => {
  const status = mapDeliveryStatus(delivery);
  const pickup = normalized(delivery.tipo_frete || order.modalidade_entrega).includes('RETIR');
  const result = {
    deliveryId: delivery.id,
    erpOrderId: first(delivery.pedido_id, order.id),
    orderNumber: first(delivery.numero_pedido, order.numero_pedido, order.numero),
    status,
    deliveryMode: pickup ? 'PICKUP' : 'DELIVERY',
    scheduledDate: first(delivery.data_agendada, delivery.data_programacao),
    estimatedDate: first(delivery.data_previsao),
    requestedDeliveryDate: first(order.data_entrega_solicitada, order.data_previsao_entrega),
    actualDeliveryDate: first(delivery.data_entrega),
    addressSummary: pickup ? null : publicAddressSummary(delivery),
    partial: status === 'PARTIAL' || delivery.entrega_parcial?.ativada === true,
    proofAvailable: deliveryProofDescriptors(delivery).length > 0,
    obraId: recordWorkId(delivery) || recordWorkId(order) || null,
    route: !pickup && (delivery.rota_id || delivery.romaneio_id) ? {
      assigned: true,
      status: status === 'ROUTED' || status === 'OUT_FOR_DELIVERY' ? status : 'ASSIGNED',
    } : null,
    driverName: pickup ? null : publicDriverName(delivery.motorista_nome || delivery.motorista),
    vehicleLabel: pickup ? null : text(delivery.veiculo || delivery.placa).slice(0, 30) || null,
    source: 'ERP',
    updatedAt: first(delivery.updated_date, delivery.created_date),
  };
  if (detailed) {
    result.items = deliveryItems(delivery, order);
    result.occurrences = publicOccurrences(delivery);
  }
  return result;
};

export const publicTimeline = (delivery = {}) => {
  const history = Array.isArray(delivery.historico_status) ? delivery.historico_status : [];
  const events = history.slice(0, 300).map((item, index) => ({
    eventId: text(item.id) || `${delivery.id}:status:${index + 1}`,
    type: mapTimelineEvent(item.status),
    status: mapDeliveryStatus({ ...delivery, status: item.status }),
    occurredAt: first(item.data_hora, item.created_date),
  })).filter((item) => item.type && item.occurredAt);
  for (const occurrence of publicOccurrences(delivery)) {
    events.push({
      eventId: occurrence.occurrenceId,
      type: occurrence.type === 'REAGENDAMENTO' ? 'RESCHEDULED' : 'OCCURRENCE_RECORDED',
      status: occurrence.type === 'REAGENDAMENTO' ? 'RESCHEDULED' : 'OCCURRENCE',
      occurredAt: occurrence.createdAt,
      publicNote: occurrence.publicNote,
    });
  }
  const unique = new Map();
  events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)).forEach((item) => {
    unique.set(`${item.type}|${item.occurredAt}`, item);
  });
  return [...unique.values()];
};
