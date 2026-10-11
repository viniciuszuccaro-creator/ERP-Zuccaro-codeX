/** Helpers compartilhados do formulário canônico de Empresa (extração de EmpresaForm). */

export const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
export const sanitizeDocument = (value, max = 32) => String(value ?? "").replace(/[^0-9A-Za-z.\-/]/g, "").slice(0, max).trim();
export const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s]/g, "").slice(0, max).trim();
export const sanitizeUrl = (value, max = 500) => String(value ?? "").replace(/[<>"']/g, "").slice(0, max).trim();
export const toInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? parseInt(value, 10) : fallback;

export const sanitizeEndereco = (endereco = {}) => ({
  logradouro: sanitizeText(endereco.logradouro, 180),
  numero: sanitizeCode(endereco.numero, 30),
  complemento: sanitizeText(endereco.complemento, 120),
  bairro: sanitizeText(endereco.bairro, 120),
  cidade: sanitizeText(endereco.cidade, 120),
  estado: sanitizeCode(endereco.estado, 2),
  cep: sanitizeCode(endereco.cep, 12),
});

export const EMPRESA_FORM_DEFAULTS = Object.freeze({
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  regime_tributario: "Simples Nacional",
  tipo: "Matriz",
  matriz_id: "",
  status: "Ativa",
  permite_emissao_fiscal: true,
  endereco: Object.freeze({
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
  }),
  contato: Object.freeze({
    telefone: "",
    email: "",
  }),
  certificado_digital: Object.freeze({
    tipo: "A1",
    arquivo_certificado: "",
    senha_certificado: "",
    data_validade: "",
  }),
  configuracao_fiscal: Object.freeze({
    ambiente_nfe: "Homologacao",
    serie_nfe: "1",
    proximo_numero_nfe: 1,
    autoriza_emissao_producao: false,
  }),
  urls_webhook_padrao: Object.freeze({
    pagamento_recebido: "",
    nfe_emitida: "",
  }),
});

export function mergeEmpresaFormData(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  const tipoRaw = sanitizeText(src.tipo || EMPRESA_FORM_DEFAULTS.tipo, 40);
  const tipo = tipoRaw === "Filial" ? "Filial" : "Matriz";
  return {
    ...EMPRESA_FORM_DEFAULTS,
    ...src,
    tipo,
    matriz_id: sanitizeText(src.matriz_id, 120),
    permite_emissao_fiscal: src.permite_emissao_fiscal !== false,
    endereco: {
      ...EMPRESA_FORM_DEFAULTS.endereco,
      ...(src.endereco && typeof src.endereco === "object" ? src.endereco : {}),
    },
    contato: {
      ...EMPRESA_FORM_DEFAULTS.contato,
      ...(src.contato && typeof src.contato === "object" ? src.contato : {}),
    },
    certificado_digital: {
      ...EMPRESA_FORM_DEFAULTS.certificado_digital,
      ...(src.certificado_digital && typeof src.certificado_digital === "object" ? src.certificado_digital : {}),
    },
    configuracao_fiscal: {
      ...EMPRESA_FORM_DEFAULTS.configuracao_fiscal,
      ...(src.configuracao_fiscal && typeof src.configuracao_fiscal === "object" ? src.configuracao_fiscal : {}),
    },
    urls_webhook_padrao: {
      ...EMPRESA_FORM_DEFAULTS.urls_webhook_padrao,
      ...(src.urls_webhook_padrao && typeof src.urls_webhook_padrao === "object" ? src.urls_webhook_padrao : {}),
    },
  };
}
