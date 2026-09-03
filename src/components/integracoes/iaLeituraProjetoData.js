export const PROJECT_READING_SCHEMA = {
  type: "object",
  properties: {
    tipo_projeto: { type: "string", enum: ["residencial", "comercial", "industrial", "outro"] },
    elementos_identificados: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        properties: {
          elemento: { type: "string" },
          tipo_peca: { type: "string", enum: ["Coluna", "Viga", "Bloco", "Sapata", "Laje", "Estaca", "Estribo", "Pilar"] },
          posicao: { type: "string" },
          bitola_principal: { type: "string" },
          quantidade_barras: { type: "number" },
          comprimento_mm: { type: "number" },
          largura_mm: { type: "number" },
          altura_mm: { type: "number" },
          estribo_bitola: { type: "string" },
          estribo_espacamento: { type: "number" },
          confianca: { type: "number", minimum: 0, maximum: 100 }
        },
        required: ["elemento", "tipo_peca", "bitola_principal", "quantidade_barras", "comprimento_mm", "confianca"]
      }
    },
    observacoes: { type: "string" }
  },
  required: ["elementos_identificados"]
};

const safeText = (value, maxLength = 200) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function normalizeProjectReadingResponse(response) {
  if (!response || !Array.isArray(response.elementos_identificados)) {
    throw new Error('InvalidProjectReadingResponse');
  }

  const elementos = response.elementos_identificados.slice(0, 500).map((item) => ({
    elemento: safeText(item?.elemento),
    tipo_peca: safeText(item?.tipo_peca),
    posicao: safeText(item?.posicao),
    bitola_principal: safeText(item?.bitola_principal),
    quantidade_barras: Math.max(0, safeNumber(item?.quantidade_barras)),
    comprimento_mm: Math.max(0, safeNumber(item?.comprimento_mm)),
    largura_mm: Math.max(0, safeNumber(item?.largura_mm)),
    altura_mm: Math.max(0, safeNumber(item?.altura_mm)),
    estribo_bitola: safeText(item?.estribo_bitola),
    estribo_espacamento: Math.max(0, safeNumber(item?.estribo_espacamento)),
    confianca: Math.min(100, Math.max(0, safeNumber(item?.confianca)))
  })).filter((item) => item.elemento && item.tipo_peca);

  return {
    tipo_projeto: safeText(response.tipo_projeto, 40) || 'outro',
    elementos_identificados: elementos,
    observacoes: safeText(response.observacoes, 2000)
  };
}

export function createSimulatedProjectReading() {
  const elementos = [
    { elemento: 'V1', tipo_peca: 'Viga', posicao: 'N1', bitola_principal: '12.5mm', quantidade_barras: 4, comprimento_mm: 4500, largura_mm: 150, altura_mm: 400, estribo_bitola: '6.3mm', estribo_espacamento: 15, confianca: 95 },
    { elemento: 'C1', tipo_peca: 'Coluna', posicao: 'N1', bitola_principal: '16.0mm', quantidade_barras: 8, comprimento_mm: 3000, largura_mm: 200, altura_mm: 200, estribo_bitola: '6.3mm', estribo_espacamento: 10, confianca: 88 },
    { elemento: 'V2', tipo_peca: 'Viga', posicao: 'N1', bitola_principal: '10.0mm', quantidade_barras: 3, comprimento_mm: 6500, largura_mm: 120, altura_mm: 350, estribo_bitola: '5.0mm', estribo_espacamento: 20, confianca: 72 }
  ];
  const confianca = elementos.reduce((sum, item) => sum + item.confianca, 0) / elementos.length;
  return {
    tipo_projeto: 'residencial',
    elementos_identificados: elementos,
    observacoes: `Simulacao concluida. Total de ${elementos.length} elementos identificados.`,
    modo: 'simulado',
    confianca_geral: confianca
  };
}