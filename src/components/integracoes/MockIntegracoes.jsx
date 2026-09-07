/**
 * 🎭 MOCK DE INTEGRAÇÕES
 * 
 * Funções simuladas que replicam o comportamento real das APIs.
 * Quando backend functions estiver habilitado, trocar estas funções
 * pelas chamadas reais: base44.functions.nome_funcao()
 * 
 * TODAS as funções retornam Promises para simular chamadas assíncronas.
 */

/**
 * 📄 NF-e - Emissão Simulada
 */
export async function mockEmitirNFe({ empresa_id, pedido, ambiente = "Homologação" }) {
  const ambienteNormalizado = String(ambiente || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (ambienteNormalizado.startsWith('prod')) {
    throw new Error('Emissao em producao exige autorizacao explicita.');
  }
  if (!empresa_id) {
    throw new Error('Empresa emitente obrigatoria para NF-e.');
  }
  await new Promise(resolve => setTimeout(resolve, 2000));

  const numero = String(pedido?.numero || pedido?.numero_nfe || Math.floor(100000 + Math.random() * 900000));
  const serie = String(pedido?.serie || "1");
  const chaveAcesso = Array(44).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
  
  return {
    success: true,
    status: "Autorizada",
    numero_nfe: numero.toString(),
    serie: serie,
    chave_acesso: chaveAcesso,
    protocolo: `${Date.now()}`,
    data_autorizacao: new Date().toISOString(),
    xml_url: `https://mock-storage.com/nfe/${chaveAcesso}.xml`,
    pdf_url: `https://mock-storage.com/nfe/${chaveAcesso}.pdf`,
    mensagem_sefaz: "100 - Autorizado o uso da NF-e",
    codigo_status: "100",
    ambiente: ambiente,
    modelo: "55",
    __simulado__: true
  };
}

/**
 * 🚫 NF-e - Cancelamento Simulado
 */
export async function mockCancelarNFe({ nfe_id, chave_acesso, motivo }) {
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    success: true,
    status: "Cancelada",
    protocolo_cancelamento: `CANC-${Date.now()}`,
    data_cancelamento: new Date().toISOString(),
    mensagem_sefaz: "101 - Cancelamento de NF-e homologado",
    xml_cancelamento_url: `https://mock-storage.com/cancel/${chave_acesso}.xml`,
    __simulado__: true
  };
}

/**
 * 📝 NF-e - Carta de Correção Simulada
 */
export async function mockCartaCorrecao({ nfe_id, chave_acesso, correcao }) {
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    success: true,
    sequencia: 1,
    protocolo: `CCE-${Date.now()}`,
    data_evento: new Date().toISOString(),
    mensagem_sefaz: "135 - Evento registrado e vinculado a NF-e",
    xml_cce_url: `https://mock-storage.com/cce/${chave_acesso}-1.xml`,
    __simulado__: true
  };
}

/**
 * 💳 Boleto - Geração Simulada
 */
export async function mockGerarBoleto({ conta_receber_id, cliente, valor, vencimento }) {
  await new Promise(resolve => setTimeout(resolve, 1500));

  const hoje = new Date();
  const dataVenc = new Date(vencimento);

  return {
    success: true,
    boleto_id: `BOL-${Date.now()}`,
    numero_documento: `${Date.now()}`.slice(-10),
    linha_digitavel: "34191.79001 01043.510047 91020.150008 1 " + Math.floor(10000000000000 + Math.random() * 90000000000000),
    codigo_barras: "34191" + Math.floor(10000000000000000000000000000000000000 + Math.random() * 90000000000000000000000000000000000000),
    valor: valor,
    vencimento: dataVenc.toISOString().split('T')[0],
    url_boleto: `https://mock-boleto.com/boleto/${Date.now()}.pdf`,
    status: "Gerado",
    nosso_numero: `${Date.now()}`.slice(-8),
    data_geracao: hoje.toISOString(),
    __simulado__: true
  };
}

/**
 * 📱 PIX - Geração Simulada
 */
export async function mockGerarPix({ conta_receber_id, cliente, valor, vencimento }) {
  await new Promise(resolve => setTimeout(resolve, 1200));

  const pixCopiaECola = `00020126580014br.gov.bcb.pix0136${Date.now()}5204000053039865802BR5913Empresa LTDA6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    success: true,
    pix_id: `PIX-${Date.now()}`,
    qrcode_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    qrcode_url: `https://mock-pix.com/qr/${Date.now()}.png`,
    pix_copia_cola: pixCopiaECola,
    valor: valor,
    vencimento: vencimento,
    status: "Ativo",
    validade_horas: 24,
    data_geracao: new Date().toISOString(),
    __simulado__: true
  };
}

/**
 * 🔔 Webhook de Pagamento Simulado
 */
export async function mockSimularPagamento({ boleto_id, pix_id, tipo }) {
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    status: "Pago",
    data_pagamento: new Date().toISOString(),
    valor_pago: 0, // será preenchido pelo componente
    forma_pagamento: tipo === "boleto" ? "Boleto Bancário" : "PIX",
    comprovante: `COMP-${Date.now()}`,
    __simulado__: true
  };
}

/**
 * 📲 WhatsApp - Envio Simulado
 */
export async function mockEnviarWhatsApp({ telefone, mensagem, anexos = [] }) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    success: true,
    message_id: `msg_${Date.now()}`,
    telefone: telefone,
    status: "Enviado",
    entregue: true,
    lido: false,
    data_envio: new Date().toISOString(),
    data_entrega: new Date().toISOString(),
    anexos_enviados: anexos.length,
    __simulado__: true
  };
}

/**
 * 🗺️ Google Maps - Geocodificação Simulada
 */
export async function mockGeocodificar({ endereco, cep, cidade, estado }) {
  await new Promise(resolve => setTimeout(resolve, 800));

  // Coordenadas simuladas baseadas no estado
  const coordsPorEstado = {
    'SP': { lat: -23.550520, lng: -46.633308 },
    'RJ': { lat: -22.906847, lng: -43.172896 },
    'MG': { lat: -19.916681, lng: -43.934493 },
    'RS': { lat: -30.034647, lng: -51.217659 },
    'PR': { lat: -25.428954, lng: -49.273251 }
  };

  const coords = coordsPorEstado[estado] || { lat: -15.793889, lng: -47.882778 };
  
  // Adiciona variação aleatória
  const latitude = coords.lat + (Math.random() - 0.5) * 0.1;
  const longitude = coords.lng + (Math.random() - 0.5) * 0.1;

  return {
    success: true,
    endereco_completo: `${endereco}, ${cidade} - ${estado}, ${cep}`,
    latitude: latitude,
    longitude: longitude,
    cidade: cidade,
    estado: estado,
    cep: cep,
    google_maps_url: `https://www.google.com/maps?q=${latitude},${longitude}`,
    __simulado__: true
  };
}

/**
 * 🚚 Google Maps - Roteirização Simulada
 */
export async function mockRoteirizar({ origem, destinos }) {
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Ordena destinos de forma "inteligente" (por cidade)
  const destinosOrdenados = [...destinos].sort((a, b) => {
    const cidadeA = a.endereco_completo?.cidade || '';
    const cidadeB = b.endereco_completo?.cidade || '';
    return cidadeA.localeCompare(cidadeB);
  });

  const pontosComSequencia = destinosOrdenados.map((destino, idx) => ({
    sequencia: idx + 1,
    ...destino,
    tempo_estimado_chegada: `${9 + Math.floor(idx * 0.5)}:${(idx * 30) % 60}`,
    distancia_anterior_km: 5 + Math.random() * 10
  }));

  const distanciaTotal = pontosComSequencia.reduce((sum, p) => sum + (p.distancia_anterior_km || 0), 0);
  const tempoTotal = pontosComSequencia.length * 25 + (distanciaTotal * 2); // 25min por parada + 2min por km

  return {
    success: true,
    pontos_otimizados: pontosComSequencia,
    distancia_total_km: distanciaTotal,
    tempo_total_minutos: tempoTotal,
    economia_km: Math.random() * 15, // economia vs rota não otimizada
    google_maps_url: `https://www.google.com/maps/dir/?api=1&waypoints=${pontosComSequencia.map(p => `${p.latitude},${p.longitude}`).join('|')}`,
    algoritmo: "Otimização Simulada",
    __simulado__: true
  };
}

/**
 * 📦 Transportadoras - Cálculo de Frete Simulado
 */
export async function mockCalcularFrete({ cep_origem, cep_destino, peso, dimensoes }) {
  await new Promise(resolve => setTimeout(resolve, 1800));

  const transportadoras = [
    { nome: "Correios PAC", prazo: 8, preco_kg: 5.50, logo: "📮" },
    { nome: "Correios SEDEX", prazo: 3, preco_kg: 9.50, logo: "📦" },
    { nome: "Jadlog", prazo: 5, preco_kg: 6.20, logo: "🚚" },
    { nome: "Total Express", prazo: 4, preco_kg: 7.00, logo: "⚡" },
    { nome: "Azul Cargo", prazo: 2, preco_kg: 12.00, logo: "✈️" }
  ];

  const opcoes = transportadoras.map(t => ({
    transportadora: t.nome,
    logo: t.logo,
    prazo_dias: t.prazo,
    valor_frete: (peso * t.preco_kg * (1 + Math.random() * 0.3)).toFixed(2),
    disponivel: true,
    codigo_rastreamento: `${t.nome.substring(0, 2).toUpperCase()}${Date.now()}`.replace(/\s/g, ''),
    __simulado__: true
  }));

  return {
    success: true,
    opcoes: opcoes,
    __simulado__: true
  };
}

/**
 * 🔄 Função auxiliar para marcar algo como simulado
 */
export function isSimulado(objeto) {
  return objeto?.__simulado__ === true;
}

/**
 * ⚠️ Aviso de Modo Simulação
 */
export function avisoModoSimulacao() {
  return {
    titulo: "⚙️ Modo Simulação",
    mensagem: "Esta integração está em modo SIMULAÇÃO. Os dados gerados são fictícios. Para ativar a integração real, habilite Backend Functions e configure as APIs.",
    cor: "amber"
  };
}

export default {
  mockEmitirNFe,
  mockCancelarNFe,
  mockCartaCorrecao,
  mockGerarBoleto,
  mockGerarPix,
  mockSimularPagamento,
  mockEnviarWhatsApp,
  mockGeocodificar,
  mockRoteirizar,
  mockCalcularFrete,
  isSimulado,
  avisoModoSimulacao
};