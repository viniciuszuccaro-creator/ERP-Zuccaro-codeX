import React, { useState, useEffect, useRef, Suspense } from "react";
import { base44, isHttpBackendMode } from "@/api/base44Client";
import { createHttpApiClient } from "@/api/httpApiClient";
import { readErpHttpSession } from "@/api/erpHttpSession";
import {
  mapClienteLocalToUiEndereco,
  syncClienteLocaisViaHttp,
  CLIENTE_LOCAIS_SYNC_PARTIAL,
  isContatoCanalCanonico,
  partitionContatosByCanal,
} from "@/api/clienteHttpPayload";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Building2,
  Phone,
  MapPin,
  DollarSign,
  FileText,
  Clock,
  Paperclip,
  Save,
  AlertCircle,
  ExternalLink,
  Trash2,
  Power,
  PowerOff
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import useCadastroFormScopeGuard from "./hooks/useCadastroFormScopeGuard";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";
import useCadastroReopenOnIdentity from "@/components/cadastros/useCadastroReopenOnIdentity";
import GerenciarContatosClienteForm from "./GerenciarContatosClienteForm";
import GerenciarEnderecosClienteForm from "./GerenciarEnderecosClienteForm";
import {
  buildClienteSugestaoVinculoBanner,
  buildClienteSugestaoVinculoRaceKey,
  documentoProntoParaSugestao,
  shouldApplyClienteSugestaoVinculoBanner,
} from "./clienteSugestaoVinculoUi";

import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
const HistoricoOrigemCliente = React.lazy(() => import("@/components/comercial/HistoricoOrigemCliente"));

const TimelineCliente = React.lazy(() => import("@/components/cliente/TimelineCliente").then(m => ({ default: m.default })));
const ResumoHistorico = React.lazy(() => import("@/components/cliente/TimelineCliente").then(m => ({ default: m.ResumoHistorico })));

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 80) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s@()+]/g, "").slice(0, max).trim();
const sanitizeBoolean = (value) => Boolean(value);
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeEndereco = (endereco = {}) => ({
  ...endereco,
  cep: sanitizeCode(endereco.cep, 12),
  logradouro: sanitizeText(endereco.logradouro, 180),
  numero: sanitizeCode(endereco.numero, 30),
  complemento: sanitizeText(endereco.complemento, 120),
  bairro: sanitizeText(endereco.bairro, 120),
  cidade: sanitizeText(endereco.cidade, 120),
  estado: sanitizeCode(endereco.estado, 2),
  latitude: endereco.latitude === null || endereco.latitude === undefined ? null : toNumber(endereco.latitude, null),
  longitude: endereco.longitude === null || endereco.longitude === undefined ? null : toNumber(endereco.longitude, null),
  mapa_url: sanitizeText(endereco.mapa_url, 300)
});
/** Preserva procedência/flags/null; rejeita acima do limite (200/2000) — sem truncar. */
/** @param {string} message @param {string} code @param {number} [status] */
const contatosValidationError = (message, code, status = 422) => {
  const err = /** @type {Error & { code: string, status: number }} */ (new Error(message));
  err.code = code;
  err.status = status;
  return err;
};
const assertContatoLen = (value, max, field) => {
  if (value == null) return value;
  const text = String(value);
  if (text.length > max) {
    throw contatosValidationError(
      `Contato.${field} excede ${max} — rejeitado sem truncamento.`,
      'CLIENTE_CONTATOS_VALIDATION',
    );
  }
  return text;
};
/** Sanitiza sem truncar: rejeita acima do limite antes de qualquer slice. */
const sanitizeContatoField = (value, max, field) => {
  if (value === undefined || value === null) return value;
  assertContatoLen(value, max, field);
  return sanitizeText(value, max);
};
const sanitizeContatos = (contatos) => {
  if (!Array.isArray(contatos)) {
    throw contatosValidationError(
      'contatos deve ser array — rejeitado sem converter em [].',
      'CLIENTE_CONTATOS_VALIDATION',
    );
  }
  if (contatos.length > 200) {
    throw contatosValidationError(
      'Contatos[] excede 200 itens — rejeitado sem truncamento.',
      'CLIENTE_CONTATOS_VALIDATION',
    );
  }
  const ids = new Set();
  let principals = 0;
  return contatos.map((contato) => {
    const obsRaw = contato?.observacao !== undefined ? contato.observacao : contato?.obs;
    const observacao = obsRaw === undefined ? undefined : (obsRaw === null ? null : sanitizeContatoField(obsRaw, 2000, 'observacao'));
    const out = {
      ...contato,
      nome: contato?.nome === undefined ? undefined : (contato.nome === null ? null : sanitizeContatoField(contato.nome, 180, 'nome')),
      cargo: contato?.cargo === undefined ? undefined : (contato.cargo === null ? null : sanitizeContatoField(contato.cargo, 120, 'cargo')),
      departamento: contato?.departamento === undefined ? undefined : (contato.departamento === null ? null : sanitizeContatoField(contato.departamento, 120, 'departamento')),
      tipo: sanitizeContatoField(contato?.tipo, 60, 'tipo'),
      valor: contato?.valor === undefined ? undefined : (contato.valor === null ? null : sanitizeContatoField(contato.valor, 180, 'valor')),
      ramal: contato?.ramal === undefined ? undefined : (contato.ramal === null ? null : sanitizeContatoField(contato.ramal, 40, 'ramal')),
      ...(observacao !== undefined ? { observacao } : {}),
    };
    if (contato?.principal !== undefined) out.principal = contato.principal === true;
    if (contato?.ativo !== undefined) out.ativo = contato.ativo === true;
    if (contato?.id != null && String(contato.id).trim() !== '') {
      const id = String(contato.id);
      if (ids.has(id)) {
        throw contatosValidationError('Contatos[] com id duplicado — rejeitado.', 'CLIENTE_CONTATOS_VALIDATION');
      }
      ids.add(id);
      out.id = id;
    }
    if (out.principal === true) principals += 1;
    if (principals > 1) {
      throw contatosValidationError('Contatos[] com múltiplos principais — rejeitado.', 'CLIENTE_CONTATOS_VALIDATION');
    }
    if (contato?.contato_b2b_id != null && String(contato.contato_b2b_id).trim() !== '') {
      throw contatosValidationError(
        'contato_b2b_id sem resolução canônica — rejeitado.',
        'CLIENTE_CONTATO_B2B_REVIEW_REQUIRED',
        409,
      );
    }
    return out;
  });
};
const sanitizeDocumentos = (documentos) => Array.isArray(documentos) ? documentos.slice(0, 100).map((doc) => ({
  ...doc,
  nome_arquivo: sanitizeText(doc?.nome_arquivo, 180),
  tipo: sanitizeText(doc?.tipo, 80),
  url_arquivo: sanitizeText(doc?.url_arquivo, 500),
  upload_por: sanitizeText(doc?.upload_por, 180)
})) : [];

export default function CadastroClienteCompleto({ cliente: clienteProp, item, data, initialData, defaultValues, isOpen, onClose, onSuccess, windowMode = false, onSubmit, onSave }) {
  // Normaliza: aceita tanto "cliente" (legado) quanto "item"/"data" (novo Visualizador)
  const cliente = clienteProp || item || data || initialData || defaultValues || null;
  const onCloseNorm = onClose || onSave || onSubmit;
  const [activeTab, setActiveTab] = useState("dados-gerais");
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    empresaAtual,
    grupoAtual,
    filterInContext,
    createInContext,
    updateInContext,
    deleteInContext
  } = useContextoVisual();
  const { canCreate, canEdit, canDelete, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || cliente?.group_id || null;
  const { isCurrent: isFormScopeCurrent, assertCurrent: assertFormScopeCurrent } = useCadastroFormScopeGuard(groupId, empresaAtual?.id);
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = Boolean(empresaAtual?.id || groupId || cliente?.empresa_id || cliente?.group_id);
  const podeCriar = canCreate("Cadastros", "Cliente") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Cliente") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "Cliente") || canDelete("Cadastros", null);
  const podeVerCliente = hasPermission("Cadastros", "Cliente", "visualizar")
    || hasPermission("Cadastros", null, "visualizar");
  const [sugestaoBanner, setSugestaoBanner] = useState(() => buildClienteSugestaoVinculoBanner({}));
  const sugestaoAbortRef = useRef(null);
  const sugestaoRaceKeyRef = useRef('');

  const consultarSugestaoVinculo = React.useCallback(async (documentoRaw) => {
    const doc = documentoProntoParaSugestao(documentoRaw);
    if (!doc) {
      sugestaoRaceKeyRef.current = '';
      setSugestaoBanner(buildClienteSugestaoVinculoBanner({
        ok: true,
        data: { sugestao: false, motivo: 'documento_ausente', mescla: 'proibida' },
      }));
      return;
    }
    if (!isHttpBackendMode || !contextoValido || !podeVerCliente || cliente?.id) {
      sugestaoRaceKeyRef.current = '';
      setSugestaoBanner(buildClienteSugestaoVinculoBanner({}));
      return;
    }
    const session = readErpHttpSession();
    if (!session?.token || !session?.groupId || !session?.actorId) {
      sugestaoRaceKeyRef.current = '';
      setSugestaoBanner(buildClienteSugestaoVinculoBanner({ ok: false, status: 401 }));
      return;
    }
    const empresaId = empresaAtual?.id || session.empresaId || null;
    const raceKey = buildClienteSugestaoVinculoRaceKey({
      documento: doc,
      groupId: session.groupId,
      empresaId,
    });
    sugestaoRaceKeyRef.current = raceKey;
    if (sugestaoAbortRef.current) sugestaoAbortRef.current.abort();
    const controller = new AbortController();
    sugestaoAbortRef.current = controller;
    try {
      const api = createHttpApiClient({
        getScope: () => ({
          token: session.token,
          groupId: session.groupId,
          empresaId,
          actorId: session.actorId,
          actorEmail: session.email || null,
        }),
      }).clientes;
      const body = await api.sugestaoVinculo({ documento: doc, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!shouldApplyClienteSugestaoVinculoBanner(sugestaoRaceKeyRef.current, raceKey)) return;
      setSugestaoBanner(buildClienteSugestaoVinculoBanner({ ok: true, data: body?.data || body }));
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') return;
      if (!shouldApplyClienteSugestaoVinculoBanner(sugestaoRaceKeyRef.current, raceKey)) return;
      setSugestaoBanner(buildClienteSugestaoVinculoBanner({
        ok: false,
        status: error?.status || 0,
        errorCode: error?.code || null,
      }));
    }
  }, [cliente?.id, contextoValido, empresaAtual?.id, podeVerCliente]);

  useEffect(() => {
    sugestaoRaceKeyRef.current = '';
    setSugestaoBanner(buildClienteSugestaoVinculoBanner({}));
    if (sugestaoAbortRef.current) sugestaoAbortRef.current.abort();
    return () => {
      if (sugestaoAbortRef.current) sugestaoAbortRef.current.abort();
    };
  }, [contextKey, groupId, empresaAtual?.id]);

  const [formData, setFormData] = useState(cliente || {
    tipo: "Pessoa Física",
    status: "Prospect",
    nome: "",
    nome_social: "",
    razao_social: "",
    nome_fantasia: "",
    cpf: "",
    cnpj: "",
    rg: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    email: "",
    telefone: "",
    celular: "",
    origem: "",
    regiao_atendimento: "Sudeste",
    endereco_principal: {
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      latitude: null,
      longitude: null,
      mapa_url: ""
    },
    contatos: [],
    locais_entrega: [],
    condicao_comercial: {
      tabela_preco_id: "",
      forma_pagamento_padrao_id: "",
      percentual_desconto: 0,
      condicao_pagamento: "À Vista",
      limite_credito: 0,
      limite_credito_utilizado: 0,
      situacao_credito: "OK"
    },
    configuracao_fiscal: {
      regime_tributario: "Simples Nacional",
      cfop_padrao_venda: "5102",
      contribuinte_icms: true,
      tipo_contribuinte: "1 - Contribuinte",
      isento_ipi: false,
      isento_icms: false
    },
    documentos: [],
    vendedor_responsavel: "",
    vendedor_responsavel_id: "",
    observacoes: "",
    empresa_id: empresaAtual?.id,
    group_id: groupId
  });

  const buildPayload = (data = formData) => {
    // Omit ≠ limpar: campo não carregado (sem hasOwn) não vira "" no fio.
    const has = (key) => Object.prototype.hasOwnProperty.call(data, key);
    const ownText = (key, max) => (has(key) ? { [key]: sanitizeText(data[key], max) } : {});
    const ownCode = (key, max) => (has(key) ? { [key]: sanitizeCode(data[key], max) } : {});
    return {
      ...data,
      ...(has('tipo') || !data.id
        ? { tipo: sanitizeText(data.tipo || 'Pessoa Fisica', 40) }
        : {}),
      ...(has('status') || !data.id
        ? { status: sanitizeText(data.status || 'Prospect', 40) }
        : {}),
      ...ownText('nome', 180),
      ...ownText('razao_social', 180),
      ...ownText('nome_fantasia', 180),
      ...ownText('nome_social', 180),
      ...ownCode('cpf', 18),
      ...ownCode('cnpj', 24),
      ...ownCode('rg', 30),
      ...ownCode('inscricao_estadual', 40),
      ...ownCode('inscricao_municipal', 40),
      ...ownText('email', 180),
      ...ownText('telefone', 40),
      ...ownText('celular', 40),
      ...ownText('observacoes', 2000),
      // origem/legado: só reenviar se carregados — procedência importada é imutável no BFF.
      ...ownText('origem', 40),
      ...(has('codigo_legado') ? { codigo_legado: sanitizeCode(data.codigo_legado, 120) } : {}),
      ...(has('source_system') ? { source_system: sanitizeText(data.source_system, 80) } : {}),
      ...(has('legacy_id') ? { legacy_id: sanitizeCode(data.legacy_id, 120) } : {}),
      ...(has('migration_batch') ? { migration_batch: sanitizeText(data.migration_batch, 120) } : {}),
      ...ownText('regiao_atendimento', 120),
      ...ownCode('regiao_atendimento_id', 120),
      ...ownText('vendedor_responsavel', 180),
      ...ownCode('vendedor_responsavel_id', 120),
      ...ownCode('indicador_id', 120),
      ...ownText('motivo_inatividade', 500),
      ...(has('endereco_principal')
        ? { endereco_principal: sanitizeEndereco(data.endereco_principal) }
        : {}),
      // null = desconhecido (não comando público); [] = limpeza explícita; omit = não tocar.
      ...(data.contatos === undefined || data.contatos === null
        ? {}
        : {
            contatos: sanitizeContatos(data.contatos),
            ...(data.expectedVersion !== undefined
              ? { expectedVersion: data.expectedVersion }
              : (data.contatos_version !== undefined
                ? { expectedVersion: data.contatos_version }
                : {})),
          }),
      ...(data.locais_entrega === undefined
        ? {}
        : {
            locais_entrega: Array.isArray(data.locais_entrega)
              ? data.locais_entrega.slice(0, 50).map(sanitizeEndereco)
              : [],
          }),
      // Campo não carregado: omitir (≠ limpar; ≠ inventar default comercial/fiscal).
      ...(data.condicao_comercial === undefined || data.condicao_comercial === null
        ? {}
        : {
            condicao_comercial: {
              ...(data.condicao_comercial || {}),
              tabela_preco_id: sanitizeCode(data.condicao_comercial?.tabela_preco_id, 120),
              forma_pagamento_padrao_id: sanitizeCode(data.condicao_comercial?.forma_pagamento_padrao_id, 120),
              percentual_desconto: toNumber(data.condicao_comercial?.percentual_desconto, 0),
              condicao_pagamento: sanitizeText(data.condicao_comercial?.condicao_pagamento || "A Vista", 80),
              limite_credito: toNumber(data.condicao_comercial?.limite_credito, 0),
              limite_credito_utilizado: toNumber(data.condicao_comercial?.limite_credito_utilizado, 0),
              situacao_credito: sanitizeText(
                data.condicao_comercial?.situacao_credito
                  || (typeof calcularSituacaoCredito === 'function' ? calcularSituacaoCredito() : 'OK'),
                40,
              ),
            },
          }),
      ...(data.configuracao_fiscal === undefined || data.configuracao_fiscal === null
        ? {}
        : {
            configuracao_fiscal: {
              ...(data.configuracao_fiscal || {}),
              regime_tributario: sanitizeText(data.configuracao_fiscal?.regime_tributario || "Simples Nacional", 80),
              cfop_padrao_venda: sanitizeCode(data.configuracao_fiscal?.cfop_padrao_venda || "5102", 12),
              contribuinte_icms: sanitizeBoolean(data.configuracao_fiscal?.contribuinte_icms),
              tipo_contribuinte: sanitizeText(data.configuracao_fiscal?.tipo_contribuinte || "1 - Contribuinte", 80),
              isento_ipi: sanitizeBoolean(data.configuracao_fiscal?.isento_ipi),
              isento_icms: sanitizeBoolean(data.configuracao_fiscal?.isento_icms),
              observacoes_fiscais: sanitizeText(data.configuracao_fiscal?.observacoes_fiscais, 1000),
            },
          }),
      ...(data.documentos === undefined ? {} : { documentos: sanitizeDocumentos(data.documentos) }),
      empresa_id: data.empresa_id || empresaAtual?.id,
      group_id: data.group_id || groupId,
    };
  };

  const { data: tabelasPreco = [] } = useQuery({
    queryKey: ['tabelas-preco', contextKey],
    queryFn: () => filterInContext('TabelaPreco', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formas-pagamento', contextKey],
    queryFn: () => filterInContext('FormaPagamento', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores', contextKey],
    queryFn: () => filterInContext('Colaborador', { status: 'Ativo' }, 'nome_completo', 200),
    enabled: contextoValido,
  });

  const { data: regioes = [] } = useQuery({
    queryKey: ['regioes', contextKey],
    queryFn: () => filterInContext('RegiaoAtendimento', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: representantes = [] } = useQuery({
    queryKey: ['representantes', contextKey],
    queryFn: () => filterInContext('Representante', { status: 'Ativo' }, 'nome', 200),
    enabled: contextoValido,
  });

  const [usuarioLogado, setUsuarioLogado] = useState(null);

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuarioLogado(user);
        
        // Se for novo cliente e não tem vendedor definido, preencher automaticamente
        if (!cliente?.id && !formData.vendedor_responsavel_id && user) {
          const colaboradorUsuario = colaboradores.find(c => c.email === user.email);
          if (colaboradorUsuario) {
            setFormData(prev => ({
              ...prev,
              vendedor_responsavel_id: colaboradorUsuario.id,
              vendedor_responsavel: colaboradorUsuario.nome_completo
            }));
          }
        }
      } catch (error) {
        console.log('Usuário não autenticado ou erro:', error);
      }
    };
    
    carregarUsuario();
  }, [colaboradores, cliente?.id]);

  const { data: ultimaNF } = useQuery({
    queryKey: ['ultima-nf-cliente', cliente?.id, contextKey],
    queryFn: () => filterInContext('NotaFiscal', { cliente_fornecedor_id: cliente.id }, '-data_emissao', 1, 'empresa_faturamento_id'),
    enabled: !!cliente?.id && contextoValido,
  });


  const { boundId: clienteBoundId } = useCadastroReopenOnIdentity(cliente, {
    formData,
    setFormData,
    emptyForm: {
      tipo: "Pessoa Física",
      status: "Prospect",
      nome: "",
      nome_social: "",
      razao_social: "",
      nome_fantasia: "",
      cpf: "",
      cnpj: "",
      rg: "",
      inscricao_estadual: "",
      inscricao_municipal: "",
      email: "",
      telefone: "",
      celular: "",
      origem: "",
      regiao_atendimento: "Sudeste",
      endereco_principal: {
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        latitude: null,
        longitude: null,
        mapa_url: "",
      },
      contatos: [],
      locais_entrega: [],
      condicao_comercial: {
        tabela_preco_id: "",
        forma_pagamento_padrao_id: "",
        percentual_desconto: 0,
        condicao_pagamento: "À Vista",
        limite_credito: 0,
        limite_credito_utilizado: 0,
        situacao_credito: "OK",
      },
      configuracao_fiscal: {
        regime_tributario: "Simples Nacional",
        cfop_padrao_venda: "5102",
        contribuinte_icms: true,
        tipo_contribuinte: "1 - Contribuinte",
        isento_ipi: false,
        isento_icms: false,
      },
      documentos: [],
      vendedor_responsavel: "",
      vendedor_responsavel_id: "",
      observacoes: "",
      empresa_id: empresaAtual?.id,
      group_id: groupId,
    },
    mapToForm: (record) => {
      // HTTP MASTER: documento(/_normalizado) → cpf/cnpj da UI (zeros preservados; não inventa).
      const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const docRaw = !blank(record?.documento)
        ? record.documento
        : (!blank(record?.cpf_cnpj)
          ? record.cpf_cnpj
          : (record?.documento_normalizado ?? ''));
      const doc = String(docRaw ?? '').trim();
      const digits = doc.replace(/\D/g, '');
      let cpf = record?.cpf;
      let cnpj = record?.cnpj;
      if (digits && !/^0+$/.test(digits)) {
        if (blank(cpf) && digits.length === 11) cpf = doc;
        if (blank(cnpj) && digits.length === 14) cnpj = doc;
      }
      const nome = blank(record?.nome) && !blank(record?.razao_social)
        ? String(record.razao_social).trim()
        : record?.nome;
      return {
        ...record,
        ...(nome !== undefined ? { nome } : {}),
        ...(cpf !== undefined ? { cpf } : {}),
        ...(cnpj !== undefined ? { cnpj } : {}),
        // Alinha documento ao campo editável para pickDoc não reenviar residual antigo.
        ...(!blank(cnpj) ? { documento: cnpj } : (!blank(cpf) ? { documento: cpf } : {})),
        // Ausência/null ≠ [] : omitir evita wipe; [] hidratado = limpeza explícita prévia.
        ...(record.contatos === undefined || record.contatos === null
          ? {}
          : { contatos: record.contatos }),
        ...(record.contatos_version !== undefined
          ? { contatos_version: record.contatos_version, expectedVersion: record.contatos_version }
          : {}),
        ...(record.locais_entrega === undefined
          ? {}
          : { locais_entrega: record.locais_entrega || [] }),
        // Ausência ≠ inventar "OK"/R$0/"Simples Nacional" (desconhecido ≠ confirmado).
        ...(record.condicao_comercial === undefined || record.condicao_comercial === null
          ? {}
          : { condicao_comercial: record.condicao_comercial }),
        ...(record.configuracao_fiscal === undefined || record.configuracao_fiscal === null
          ? {}
          : { configuracao_fiscal: record.configuracao_fiscal }),
        ...(record.documentos === undefined ? {} : { documentos: record.documentos || [] }),
      };
    },
  });

  const saveMutation = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: async (data) => {
      assertFormScopeCurrent();
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou empresa antes de salvar o cliente.");
      }

      const payload = buildPayload(data);
      // Write canônico: locais via /clientes/:id/locais — não empurrar no MASTER.
      const locaisDraft = Object.prototype.hasOwnProperty.call(payload, 'locais_entrega')
        ? payload.locais_entrega
        : undefined;
      if (isHttpBackendMode && locaisDraft !== undefined) {
        delete payload.locais_entrega;
      }
      // Anexos documentos[] ≠ CPF/CNPJ MASTER ≠ ModeloDocumento — sem DocumentosCliente paralelo.
      // Não vazio: fail-closed antes do MASTER (erro HTTP ≠ sucesso local). Vazio/omit: não envia.
      if (isHttpBackendMode) {
        const docsDraft = Object.prototype.hasOwnProperty.call(payload, 'documentos')
          ? payload.documentos
          : undefined;
        if (Array.isArray(docsDraft) && docsDraft.length > 0) {
          const err = /** @type {Error & { code: string, status: number, fields: string[] }} */ (
            new Error(
              'Anexos documentos[] ainda sem contrato BFF. Rascunho preservado — '
                + 'CPF/CNPJ e demais campos MASTER não foram enviados neste save.',
            )
          );
          err.code = 'CLIENTE_HTTP_UNSUPPORTED_FIELDS';
          err.status = 422;
          err.fields = ['documentos'];
          throw err;
        }
        delete payload.documentos;
      }

      // Identidade do rascunho (boundId), não props — evita salvar A em B após reject switch.
      const targetId = clienteBoundId || formData?.id || null;
      let saved;
      if (targetId) {
        if (!podeEditar) throw new Error("Seu perfil nao permite editar clientes.");
        saved = await updateInContext('Cliente', targetId, payload);
      } else {
        if (!podeCriar) throw new Error("Seu perfil nao permite criar clientes.");
        saved = await createInContext('Cliente', payload);
      }

      if (isHttpBackendMode && locaisDraft !== undefined) {
        assertFormScopeCurrent();
        const clienteId = String(
          (saved && typeof saved === 'object' && /** @type {{ id?: unknown }} */ (saved).id)
            || targetId
            || '',
        ).trim();
        if (!clienteId) {
          throw new Error(
            'Cliente MASTER gravado, mas id ausente para sincronizar endereços canônicos. '
              + 'Rascunho de locais preservado — reabra e salve novamente.',
          );
        }
        const sessionBefore = readErpHttpSession();
        if (!sessionBefore?.token || !sessionBefore?.groupId) {
          throw new Error(
            'Sessão HTTP indisponível após salvar MASTER — endereços não sincronizados. '
              + 'Erro remoto ≠ sucesso local; reabra o cadastro.',
          );
        }
        const frozenScope = Object.freeze({
          token: String(sessionBefore.token || ''),
          groupId: String(sessionBefore.groupId || ''),
          empresaId: String(sessionBefore.empresaId || ''),
          actorId: String(sessionBefore.actorId || ''),
          clienteId,
        });
        const assertLocaisScope = () => {
          assertFormScopeCurrent();
          const now = /** @type {Record<string, unknown>} */ (readErpHttpSession() || {});
          if (
            String(now.token || '') !== frozenScope.token
            || String(now.groupId || '') !== frozenScope.groupId
            || String(now.empresaId || '') !== frozenScope.empresaId
            || String(now.actorId || '') !== frozenScope.actorId
          ) {
            const err = /** @type {Error & { code: string, status: number }} */ (
              new Error('Contexto/sessão mudou durante sync de endereços. Reabra o cadastro.')
            );
            err.code = 'CONTEXT_CHANGED';
            err.status = 409;
            throw err;
          }
        };
        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });
        // baselineIds null se carga falhou: campo não carregado não apaga persistido.
        const baselineView = locaisHttpBaselineRef.current;
        const baselineIds = Array.isArray(baselineView)
          ? baselineView
            .map((row) => (row && typeof row === 'object'
              ? String(/** @type {{ id?: unknown }} */ (row).id || '').trim()
              : ''))
            .filter(Boolean)
          : null;
        try {
          const locaisSummary = await syncClienteLocaisViaHttp({
            clienteId: frozenScope.clienteId,
            draft: locaisDraft,
            baselineIds,
            assertScope: assertLocaisScope,
            api: api.clientes,
          });
          // Summary no ref: mutation continua retornando o MASTER (contrato AST/consumidores).
          lastLocaisSyncSummaryRef.current = locaisSummary;
        } catch (syncErr) {
          lastLocaisSyncSummaryRef.current = null;
          const code = /** @type {Error & { code?: string }} */ (syncErr)?.code;
          if (code === CLIENTE_LOCAIS_SYNC_PARTIAL) {
            // Estado real: reconcilia baseline/rascunho com listLocais (reexecução segura).
            try {
              assertLocaisScope();
              const rows = await api.clientes.listLocais(frozenScope.clienteId, {
                limit: 50, ativo: true,
              });
              const mapped = (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(
                /** @type {Record<string, unknown>} */ (row),
              ));
              setLocaisHttpView(mapped);
              locaisHttpBaselineRef.current = mapped;
              setFormData((prev) => ({ ...prev, locais_entrega: mapped }));
            } catch {
              locaisHttpBaselineRef.current = null;
            }
          }
          throw syncErr;
        }
      }

      return saved;
    },
    onSuccess: (_result, savedPayload) => {
      if (!isFormScopeCurrent()) return;
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      const locaisSummary = lastLocaisSyncSummaryRef.current;
      lastLocaisSyncSummaryRef.current = null;
      const verb = formData?.id ? 'atualizado' : 'criado';
      if (
        locaisSummary
        && locaisSummary.skipped !== true
        && locaisSummary.batchAtomic === false
      ) {
        const ops = Number(locaisSummary.created || 0)
          + Number(locaisSummary.updated || 0)
          + Number(locaisSummary.deleted || 0);
        // BATCH_ATOMIC=false = limitação BFF — não declarar salvamento integral/atômico.
        toast({
          title: `Cliente ${verb}`,
          description: ops > 0
            ? `Endereços sincronizados em ${ops} operação(ões). Lote não atômico no BFF (BATCH_ATOMIC=false) — não é salvamento integral.`
            : 'Cliente gravado. Sync de endereços sem operações (lote não atômico no BFF).',
        });
      } else {
        toast({ title: `✅ Cliente ${verb} com sucesso!` });
      }
      if (onSuccess) onSuccess();
      if (onSubmit) onSubmit(savedPayload || buildPayload(formData));
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      const sameScope = isFormScopeCurrent();
      const err = /** @type {Error & { code?: string, summary?: { reconcileRequired?: boolean } }} */ (error);
      const partial = err?.code === CLIENTE_LOCAIS_SYNC_PARTIAL;
      // MASTER pode ter gravado; sync parcial ≠ sucesso — invalida; UI já reconciliou se possível.
      if (partial) {
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
      }
      toast({
        title: !sameScope
          ? "Contexto alterado"
          : (partial ? "❌ Endereços parcialmente sincronizados" : "❌ Erro ao salvar cliente"),
        description: sameScope
          ? (err?.message || String(error))
          : "A operação anterior falhou. Reabra o cadastro no contexto atual.",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      assertFormScopeCurrent();
      if (!contextoValido) throw new Error("Selecione um grupo ou empresa antes de excluir clientes.");
      if (!podeExcluir) throw new Error("Seu perfil nao permite excluir clientes.");
      return deleteInContext('Cliente', id);
    },
    onSuccess: () => {
      if (!isFormScopeCurrent()) return;
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: "✅ Cliente excluído com sucesso!" });
      if (onSuccess) onSuccess();
      if (onCloseNorm) onCloseNorm();
    },
    onError: (error) => {
      const sameScope = isFormScopeCurrent();
      toast({
        title: sameScope ? "❌ Erro ao excluir cliente" : "Contexto alterado",
        description: sameScope ? (error?.message || String(error)) : "A operação anterior falhou. Reabra o cadastro no contexto atual.",
        variant: "destructive"
      });
    }
  });

  const handleExcluir = () => {
    try { assertFormScopeCurrent(); }
    catch (error) { toast({ title: 'Contexto alterado', description: error.message, variant: 'destructive' }); return; }
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    if (!formData?.id) return;
    deleteMutation.mutate(formData.id);
  };

  const handleAlternarStatus = () => {
    if (!podeEditar) {
      toast({ title: "Seu perfil nao permite alterar status de clientes.", variant: "destructive" });
      return;
    }
    if (!contextoValido) {
      toast({ title: "Selecione grupo ou empresa antes de alterar status.", variant: "destructive" });
      return;
    }
    const novoStatus = formData.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setFormData({ ...formData, status: novoStatus });
  };

  /** Rascunho de contatos/endereços — NÃO grava no backend; só `handleSave`/`saveMutation` persistem. */
  /**
   * Exibição Contatos: canais canônicos apenas (quarentena ≠ contato válido).
   * Sem contatos[] no transporte: resumo escalar (≠ lista completa); omit-if-unknown no save.
   * Celular ≠ WhatsApp automático (mesmo contrato do Painel).
   */
  const contatosQuarentena = Array.isArray(formData.contatos)
    ? partitionContatosByCanal(formData.contatos).quarentena
    : [];
  const contatosViewForUi = (() => {
    if (Array.isArray(formData.contatos)) {
      return formData.contatos.filter((c) => isContatoCanalCanonico(c?.tipo));
    }
    const items = formData.contatos_escalares?.items;
    if (Array.isArray(items) && items.length > 0) {
      return items
        .map((item) => ({
          nome: "",
          tipo: item.tipo || item.canal || "Telefone",
          valor: item.valor || "",
          principal: false,
        }))
        .filter((c) => isContatoCanalCanonico(c.tipo));
    }
    const seeded = [];
    const push = (tipo, valor) => {
      if (valor == null || String(valor).trim() === "") return;
      seeded.push({ nome: "", tipo, valor: String(valor).trim(), principal: false });
    };
    push("E-mail", formData.email);
    push("Telefone", formData.telefone);
    push("Celular", formData.celular);
    return seeded;
  })();

  /** Locais canônicos BFF — leitura; write via `/locais` no save (não MASTER). */
  const [locaisHttpView, setLocaisHttpView] = useState(/** @type {unknown[]|undefined} */ (undefined));
  /** Baseline lido para soft-delete só quando a carga HTTP concluiu (ref evita stale no mutate). */
  const locaisHttpBaselineRef = useRef(/** @type {unknown[]|null|undefined} */ (undefined));
  /** Último summary de sync `/locais` — BATCH_ATOMIC=false nunca vira toast de salvamento integral. */
  const lastLocaisSyncSummaryRef = useRef(/** @type {{
    skipped?: boolean,
    batchAtomic?: boolean,
    created?: number,
    updated?: number,
    deleted?: number,
  }|null} */ (null));
  useEffect(() => {
    const id = clienteBoundId || cliente?.id || null;
    if (!id || !isHttpBackendMode) {
      setLocaisHttpView(undefined);
      locaisHttpBaselineRef.current = undefined;
      return undefined;
    }
    let cancelled = false;
    const session = readErpHttpSession();
    if (!session?.token || !session?.groupId) {
      setLocaisHttpView(undefined);
      locaisHttpBaselineRef.current = undefined;
      return undefined;
    }
    (async () => {
      try {
        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });
        const rows = await api.clientes.listLocais(id, { limit: 50, ativo: true });
        if (cancelled) return;
        const mapped = (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(
          /** @type {Record<string, unknown>} */ (row),
        ));
        setLocaisHttpView(mapped);
        locaisHttpBaselineRef.current = mapped;
      } catch {
        if (!cancelled) {
          setLocaisHttpView(undefined);
          // Carga falhou: não autoriza remoção por omissão.
          locaisHttpBaselineRef.current = null;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [clienteBoundId, cliente?.id]);

  const locaisViewForUi = Array.isArray(formData.locais_entrega)
    ? formData.locais_entrega
    : (Array.isArray(locaisHttpView) ? locaisHttpView : []);

  const applyContatosDraft = (novosContatos) => {
    setFormData((prev) => {
      const quarantine = Array.isArray(prev.contatos)
        ? partitionContatosByCanal(prev.contatos).quarentena
        : [];
      const validos = Array.isArray(novosContatos) ? novosContatos : [];
      return { ...prev, contatos: [...validos, ...quarantine] };
    });
  };
  const applyEnderecosDraft = (novosEnderecos) => {
    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));
  };

  /** Gravação efetiva no backend (proprietário canônico de persistência deste cadastro). */
  const handleSave = () => {
    try { assertFormScopeCurrent(); }
    catch (error) { toast({ title: 'Contexto alterado', description: error.message, variant: 'destructive' }); return; }
    setIsSaving(true);
    saveMutation.mutate(buildPayload(formData), {
      onSettled: () => setIsSaving(false)
    });
  };

  const calcularSituacaoCredito = () => {
    // Sem bloco comercial carregado: não fingir OK/R$0.
    if (formData.condicao_comercial === undefined || formData.condicao_comercial === null) {
      return 'Desconhecido';
    }
    const limite = formData.condicao_comercial?.limite_credito || 0;
    const utilizado = formData.condicao_comercial?.limite_credito_utilizado || 0;
    const percentualUtilizado = limite > 0 ? (utilizado / limite) * 100 : 0;

    if (formData.status === 'Bloqueado') return 'Bloqueado';
    if (percentualUtilizado >= 90) return 'Bloqueado';
    if (percentualUtilizado >= 70) return 'Alerta';
    return 'OK';
  };

  const handleDadosCNPJ = (dados) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        nome: dados.razao_social || prev.nome,
        razao_social: dados.razao_social || "",
        nome_fantasia: dados.nome_fantasia || "",
        inscricao_estadual: dados.inscricao_estadual || prev.inscricao_estadual,
        inscricao_municipal: dados.inscricao_municipal || prev.inscricao_municipal,
        cnae_principal: dados.cnae_principal || prev.cnae_principal,
        ramo_atividade: dados.cnae_principal || prev.ramo_atividade,
        status_fiscal_receita: dados.situacao_cadastral || "Não Verificado",
        porte_empresa: dados.porte || prev.porte_empresa,
        endereco_principal: {
          ...prev.endereco_principal,
          cep: dados.endereco_completo?.cep || prev.endereco_principal.cep,
          logradouro: dados.endereco_completo?.logradouro || prev.endereco_principal.logradouro,
          numero: dados.endereco_completo?.numero || prev.endereco_principal.numero,
          bairro: dados.endereco_completo?.bairro || prev.endereco_principal.bairro,
          cidade: dados.endereco_completo?.cidade || prev.endereco_principal.cidade,
          estado: dados.endereco_completo?.uf || prev.endereco_principal.estado,
          complemento: dados.endereco_completo?.complemento || prev.endereco_principal.complemento
        },
        configuracao_fiscal: {
          ...(prev.configuracao_fiscal || {}),
          regime_tributario: dados.porte === 'MEI' ? 'MEI' :
                            ['ME', 'EPP'].includes(dados.porte) ? 'Simples Nacional' :
                            (prev.configuracao_fiscal?.regime_tributario || 'Simples Nacional'),
        }
      };

      if (dados.email && !(newFormData.contatos || []).some(c => c.valor === dados.email)) {
        newFormData.contatos = [
          ...(newFormData.contatos || []),
          { tipo: 'E-mail', valor: dados.email, principal: true }
        ];
      }

      if (dados.telefone && !(newFormData.contatos || []).some(c => c.valor === dados.telefone)) {
        newFormData.contatos = [
          ...(newFormData.contatos || []),
          { tipo: 'Telefone', valor: dados.telefone, principal: !dados.email }
        ];
      }
      return newFormData;
    });

    toast({
      title: "✅ Dados REAIS da Receita Federal preenchidos!",
      description: `${dados.razao_social} - ${dados.situacao_cadastral}${dados.inscricao_estadual ? ' - IE: ' + dados.inscricao_estadual : ''}`,
      duration: 5000
    });
  };

  const handleDadosCEP = (dados) => {
    setFormData(prev => ({
      ...prev,
      endereco_principal: {
        ...prev.endereco_principal,
        logradouro: dados.logradouro || "",
        bairro: dados.bairro || "",
        cidade: dados.cidade || "",
        estado: dados.uf || "",
        latitude: dados.latitude || null,
        longitude: dados.longitude || null,
        mapa_url: dados.latitude && dados.longitude
          ? `https://www.google.com/maps?q=${dados.latitude},${dados.longitude}`
          : ""
      }
    }));

    toast({ title: "✅ Endereço preenchido automaticamente!" });
  };

  const gerarMapaUrl = (endereco) => {
    if (endereco.latitude && endereco.longitude) {
      return `https://www.google.com/maps?q=${endereco.latitude},${endereco.longitude}`;
    }
    if (endereco.cep) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${endereco.logradouro}, ${endereco.numero}, ${endereco.bairro}, ${endereco.cidade}, ${endereco.estado}, ${endereco.cep}`
      )}`;
    }
    return "";
  };

  const content = (
    <>
      <div className="border-b pb-4 px-6 pt-6 flex-shrink-0 bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <User className="w-6 h-6 text-sky-600" />
                {cliente?.id ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              {cliente?.id && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={
                    formData.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    formData.status === 'Prospect' ? 'bg-sky-100 text-sky-700' :
                    formData.status === 'Bloqueado' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {formData.status}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    {formData.tipo === 'Pessoa Física' ? formData.cpf : formData.cnpj}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {cliente?.id && (
                <>
                  <Button
                                    type="button"
                                    variant="outline"
                                    data-permission="Cadastros.Cliente.editar"
                                    data-action="Cadastros.Cliente.alterarStatus"
                                    data-sensitive
                                    onClick={handleAlternarStatus}
                                    disabled={!podeEditar || !contextoValido}
                                    className={formData.status === 'Ativo' ? 'border-orange-300 text-orange-700' : 'border-green-300 text-green-700'}
                  >
                    {formData.status === 'Ativo' ? (
                      <>
                        <PowerOff className="w-4 h-4 mr-2" />
                        Inativar
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4 mr-2" />
                        Ativar
                      </>
                    )}
                  </Button>
                  <Button
                                    type="button"
                                    variant="destructive"
                                    data-permission="Cadastros.Cliente.excluir"
                                    data-sensitive
                                    onClick={handleExcluir}
                                    disabled={deleteMutation.isPending || !podeExcluir || !contextoValido}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                  </Button>
                </>
              )}
              <Button
                onClick={handleSave}
                data-permission={cliente?.id ? "Cadastros.Cliente.editar" : "Cadastros.Cliente.criar"}
                data-action="Cadastros.Cliente.salvar"
                data-sensitive
                disabled={isSaving || saveMutation.isPending || !contextoValido || (clienteBoundId ? !podeEditar : !podeCriar)}
                className="bg-sky-600 hover:bg-sky-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Salvando..' : 'Salvar Cliente'}
              </Button>
            </div>
          </div>
      </div>

      {Boolean(cliente?.id) && (
        formData.contatos === undefined
        || formData.locais_entrega === undefined
        || formData.documentos === undefined
        || formData.condicao_comercial === undefined
        || formData.configuracao_fiscal === undefined
      ) && (
        <div
          className="mx-6 mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shrink-0"
          data-pendencia="cliente-parcial"
          role="status"
        >
          {[
            formData.contatos === undefined ? "contatos" : null,
            formData.locais_entrega === undefined ? "endereços de entrega/cobrança" : null,
            formData.documentos === undefined ? "documentos" : null,
            formData.condicao_comercial === undefined ? "condição comercial/crédito" : null,
            formData.configuracao_fiscal === undefined ? "configuração fiscal" : null,
          ].filter(Boolean).join(", ")
            + " ainda não recuperados nesta carga — o salvamento omite esses campos (sem apagar a fonte)."}
          {" "}Endereço cadastral/fiscal permanece em Dados Gerais; não presumir entrega = cadastral. Celular ≠ WhatsApp.
          {" "}Desconhecido ≠ confirmado (crédito/regime).
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-7 flex-shrink-0 px-6 bg-slate-50">
            <TabsTrigger value="dados-gerais" className="text-xs">
              <User className="w-3 h-3 mr-1" />
              Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="contatos" className="text-xs">
              <Phone className="w-3 h-3 mr-1" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="enderecos" className="text-xs">
              <MapPin className="w-3 h-3 mr-1" />
              Endereços
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">
              <DollarSign className="w-3 h-3 mr-1" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="fiscal" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Fiscal
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs" disabled={!cliente?.id}>
              <Clock className="w-3 h-3 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="anexos" className="text-xs">
              <Paperclip className="w-3 h-3 mr-1" />
              Anexos
            </TabsTrigger>
          </TabsList>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6">
            <TabsContent value="dados-gerais" className="space-y-6 m-0 mt-4">
              {sugestaoBanner.visible && !cliente?.id && (
                <Alert
                  className={
                    sugestaoBanner.tone === 'match'
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-300 bg-slate-50'
                  }
                  data-action="cliente-sugestao-vinculo"
                  data-sugestao-tone={sugestaoBanner.tone}
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold text-sm">{sugestaoBanner.title}</p>
                    <p className="text-sm mt-1">{sugestaoBanner.detail}</p>
                    <p className="text-xs mt-2 text-slate-600">
                      Esta tela não mescla cadastros. Use o cliente existente ou revise com autorização.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
              <CadastroCodigoRegistroField
                hasId={Boolean(cliente?.id)}
                entityId={cliente?.id}
                value={formData.codigo ?? cliente?.codigo}
                action="codigo-registro-cliente-completo"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de Pessoa *</Label>
                  <Select
                    value={formData.tipo || "Pessoa Física"}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                      <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Situação *</Label>
                  <Select
                    value={formData.status || "Prospect"}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione a situação..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Prospect">Prospect</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="nome">Nome / Razão Social *</Label>
                  <Input
                    id="nome"
                    value={formData.nome ?? ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="nome_social">Nome social</Label>
                  <Input
                    id="nome_social"
                    value={formData.nome_social ?? ''}
                    onChange={(e) => setFormData({ ...formData, nome_social: e.target.value })}
                    data-campo="nome_social"
                    placeholder={formData.nome_social === undefined ? 'Não recuperado nesta carga' : undefined}
                  />
                </div>

                {(formData.origem || formData.codigo_legado || formData.source_system) && (
                  <div
                    className="col-span-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                    data-fonte="cliente-procedencia"
                    role="status"
                  >
                    <p>
                      Procedência:
                      {' '}
                      <span data-campo="origem">{formData.origem || '—'}</span>
                      {formData.codigo_legado ? (
                        <>
                          {' · '}código legado <span data-campo="codigo_legado">{String(formData.codigo_legado)}</span>
                        </>
                      ) : null}
                      {formData.source_system ? (
                        <>
                          {' · '}fonte <span data-campo="source_system">{String(formData.source_system)}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1 text-slate-500">
                      Campos de procedência importada não são alteráveis aqui — omitir no save ≠ limpar.
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-campo="email"
                    placeholder={formData.email === undefined ? 'Não recuperado nesta carga' : undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone ?? ''}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    data-campo="telefone"
                    placeholder={formData.telefone === undefined ? 'Não recuperado nesta carga' : undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="celular">Celular</Label>
                  <Input
                    id="celular"
                    value={formData.celular ?? ''}
                    onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    data-campo="celular"
                    placeholder={formData.celular === undefined ? 'Não recuperado nesta carga' : undefined}
                  />
                  <p className="text-xs text-slate-500 mt-1">Celular ≠ WhatsApp (canal tipado só em Contatos).</p>
                </div>

                {formData.tipo === "Pessoa Jurídica" && (
                  <>
                    <div>
                      <Label htmlFor="razao_social">Razão Social</Label>
                      <Input
                        id="razao_social"
                        value={formData.razao_social}
                        onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                      <Input
                        id="nome_fantasia"
                        value={formData.nome_fantasia}
                        onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => {
                          setFormData({ ...formData, cnpj: e.target.value });
                          if (!documentoProntoParaSugestao(e.target.value)) {
                            setSugestaoBanner(buildClienteSugestaoVinculoBanner({}));
                          }
                        }}
                        onBlur={(e) => { void consultarSugestaoVinculo(e.target.value); }}
                        placeholder="00.000.000/0000-00"
                        data-action="cliente-cnpj"
                      />
                    </div>

                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica
                        tipo="cnpj"
                        valor={formData.cnpj}
                        onDadosEncontrados={handleDadosCNPJ}
                        disabled={!formData.cnpj || formData.cnpj.replace(/\D/g, '').length < 14}
                      />
                    </div>

                    <div>
                      <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                      <Input
                        id="inscricao_estadual"
                        value={formData.inscricao_estadual ?? ''}
                        onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                        data-campo="inscricao_estadual"
                        placeholder={formData.inscricao_estadual === undefined ? 'Não recuperado nesta carga' : undefined}
                      />
                    </div>

                    <div>
                      <Label htmlFor="inscricao_municipal">Inscrição Municipal</Label>
                      <Input
                        id="inscricao_municipal"
                        value={formData.inscricao_municipal ?? ''}
                        onChange={(e) => setFormData({ ...formData, inscricao_municipal: e.target.value })}
                        data-campo="inscricao_municipal"
                        placeholder={formData.inscricao_municipal === undefined ? 'Não recuperado nesta carga' : undefined}
                      />
                    </div>
                  </>
                )}

                {formData.tipo === "Pessoa Física" && (
                  <>
                    <div>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => {
                          setFormData({ ...formData, cpf: e.target.value });
                          if (!documentoProntoParaSugestao(e.target.value)) {
                            setSugestaoBanner(buildClienteSugestaoVinculoBanner({}));
                          }
                        }}
                        onBlur={(e) => { void consultarSugestaoVinculo(e.target.value); }}
                        placeholder="000.000.000-00"
                        data-action="cliente-cpf"
                      />
                    </div>

                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica
                        tipo="cpf"
                        valor={formData.cpf}
                        onDadosEncontrados={(dados) => {
                          if (dados.valido) {
                            setFormData({ ...formData, cpf: dados.formatado });
                            toast({ title: "✅ CPF validado com sucesso!" });
                          }
                        }}
                        disabled={!formData.cpf || formData.cpf.replace(/\D/g, '').length < 11}
                      />
                    </div>

                    <div>
                  <Label htmlFor="rg">RG</Label>
                  <Input
                        id="rg"
                        value={formData.rg ?? ''}
                        onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                        data-campo="rg"
                        data-persistencia={formData.rg === undefined ? 'nao-carregado' : 'rascunho'}
                        placeholder={formData.rg === undefined ? 'Não recuperado nesta carga' : undefined}
                      />
                      <p className="text-xs text-amber-800 mt-1" data-campo-estado="rg-bff">
                        RG com valor ainda exige contrato BFF — save HTTP fail-closed se preenchido; omitir ≠ limpar.
                      </p>
                    </div>
                  </>
                )}

                <div className="col-span-2 pt-4 border-t">
                  <h3 className="font-semibold mb-3">Endereço Principal</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={formData.endereco_principal?.cep || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            cep: e.target.value
                          }
                        })}
                        placeholder="00000-000"
                      />
                    </div>

                    <div>
                      <Label>&nbsp;</Label>
                      <BotaoBuscaAutomatica
                        tipo="cep"
                        valor={formData.endereco_principal?.cep}
                        onDadosEncontrados={handleDadosCEP}
                        disabled={!formData.endereco_principal?.cep || formData.endereco_principal.cep.replace(/\D/g, '').length < 8}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="logradouro">Logradouro</Label>
                      <Input
                        id="logradouro"
                        value={formData.endereco_principal?.logradouro || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            logradouro: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="numero">Número</Label>
                      <Input
                        id="numero"
                        value={formData.endereco_principal?.numero || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            numero: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        value={formData.endereco_principal?.bairro || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            bairro: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={formData.endereco_principal?.cidade || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            cidade: e.target.value
                          }
                        })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="estado">UF</Label>
                      <Input
                        id="estado"
                        value={formData.endereco_principal?.estado || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          endereco_principal: {
                            ...formData.endereco_principal,
                            estado: e.target.value
                          }
                        })}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="regiao_atendimento_id">Região de Atendimento</Label>
                  <Select 
                    value={formData.regiao_atendimento_id || ""} 
                    onValueChange={(value) => {
                      const regiao = regioes.find(r => r.id === value);
                      setFormData({ 
                        ...formData, 
                        regiao_atendimento_id: value,
                        regiao_atendimento_nome: regiao?.nome_regiao || ''
                      });
                    }}
                  >
                    <SelectTrigger id="regiao_atendimento_id">
                      <SelectValue placeholder="Selecione a região" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {regioes.filter(r => r.ativo).map((regiao) => (
                        <SelectItem key={regiao.id} value={regiao.id}>
                          {regiao.nome_regiao} {regiao.tipo_regiao && `(${regiao.tipo_regiao})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vendedor_responsavel_id">
                    Vendedor Responsável {!cliente?.id && <span className="text-xs text-green-600">(Preenchido Automaticamente)</span>}
                  </Label>
                  <Select
                    value={formData.vendedor_responsavel_id || ""}
                    onValueChange={(value) => {
                      const vendedor = colaboradores.find(c => c.id === value);
                      setFormData({
                        ...formData,
                        vendedor_responsavel_id: value,
                        vendedor_responsavel: vendedor?.nome_completo || ""
                      });
                    }}
                  >
                    <SelectTrigger id="vendedor_responsavel_id" className={!cliente?.id && formData.vendedor_responsavel_id ? 'border-green-300 bg-green-50' : ''}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {colaboradores.filter(c => c.departamento === 'Comercial').map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_completo} - {c.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="indicador_id">
                    💰 Indicador (Comissão/Cashback)
                    <span className="text-xs text-slate-500 ml-2">Representante • Construtor • Arquiteto • Engenheiro</span>
                  </Label>
                  <Select
                    value={formData.indicador_id || ""}
                    onValueChange={(value) => {
                      const indicador = representantes.find(r => r.id === value);
                      setFormData({
                        ...formData,
                        indicador_id: value,
                        indicador_nome: indicador?.nome || "",
                        tipo_indicador: indicador?.tipo_representante || "",
                        percentual_comissao_indicador: indicador?.percentual_comissao || 0
                      });
                    }}
                  >
                    <SelectTrigger id="indicador_id" className="w-full">
                      <SelectValue placeholder="Quem indicou este cliente?" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                     <SelectItem value={null}>
                       <span className="text-slate-400">❌ Nenhum indicador</span>
                     </SelectItem>
                     {representantes.map(rep => (
                       <SelectItem key={rep.id} value={rep.id}>
                         <span className="font-medium">{rep.nome}</span>
                         <span className="text-xs text-slate-500 ml-2">
                           ({rep.tipo_representante || 'Representante'})
                         </span>
                         {rep.percentual_comissao > 0 && (
                           <span className="text-xs text-green-600 ml-1">
                             - {rep.percentual_comissao}%
                           </span>
                         )}
                       </SelectItem>
                     ))}
                    </SelectContent>
                    </Select>
                    </div>

                <div className="col-span-2">
                  {formData.indicador_id && representantes.find(r => r.id === formData.indicador_id) && (
                    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                      <CardContent className="p-3">
                        {(() => {
                          const indicador = representantes.find(r => r.id === formData.indicador_id);
                          return (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                  <span className="text-white text-lg">💰</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-green-900">{indicador.nome}</p>
                                  <p className="text-xs text-green-700">
                                    {indicador.tipo_representante || 'Representante'} • {indicador.tipo_comissao || 'Percentual'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {indicador.percentual_comissao > 0 && (
                                  <p className="text-lg font-bold text-green-600">
                                    {indicador.percentual_comissao}%
                                  </p>
                                )}
                                {indicador.valor_fixo_comissao > 0 && (
                                  <p className="text-sm text-green-700">
                                    + R$ {indicador.valor_fixo_comissao.toLocaleString('pt-BR')} fixo
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {(formData.status === 'Inativo' || formData.status === 'Bloqueado') && (
                  <div className="col-span-2">
                    <Label htmlFor="motivo_inatividade">Motivo de Inativação/Bloqueio *</Label>
                    <Textarea
                      id="motivo_inatividade"
                      value={formData.motivo_inatividade}
                      onChange={(e) => setFormData({ ...formData, motivo_inatividade: e.target.value })}
                      rows={2}
                      required
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações Internas</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes ?? ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    data-campo="observacoes"
                    placeholder={formData.observacoes === undefined ? 'Não recuperado nesta carga — omitir ≠ limpar' : undefined}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contatos" className="m-0 mt-4" data-cadastro-commit="draft">
              {isHttpBackendMode && (
                <p
                  className="mb-2 text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded px-2 py-1.5"
                  data-fonte="contatos-jsonb-http"
                  data-contrato="contatos-array-master"
                  role="status"
                >
                  Contrato MASTER `contatos[]` (decisão a): leitura/gravação no cadastro canônico.
                  Escalares espelhados best-effort; Celular ≠ WhatsApp. Sem ContatoClienteV2; ContatoB2B FK
                  não destrava este fluxo. Omitir no save ≠ limpar; `[]` limpa. Salvar não duplica canais.
                </p>
              )}
              {formData.contatos === undefined && contatosViewForUi.length > 0 && (
                <p className="mb-2 text-xs text-slate-600" data-fonte="contatos-escalares-http" role="status">
                  Contatos escalares do MASTER (e-mail/telefone/celular). Editar assume a lista no rascunho;
                  Celular não vira WhatsApp automaticamente.
                </p>
              )}
              {contatosQuarentena.length > 0 && (
                <div
                  className="mb-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 space-y-1"
                  data-fonte="contatos-quarentena"
                  role="status"
                >
                  <p>
                    {contatosQuarentena.length} canal(is) em quarentena (tipo inválido) — preservados no save,
                    não confirmados como contato válido. Revisar/corrigir tipo canônico antes de tratar como válido.
                  </p>
                  <ul className="list-disc pl-4" data-quarentena-lista="contatos">
                    {contatosQuarentena.slice(0, 20).map((row, idx) => {
                      const tipo = String(row?.tipo ?? '').trim() || '(sem tipo)';
                      const valor = String(row?.valor ?? '').trim() || '(sem valor)';
                      const nome = String(row?.nome ?? '').trim();
                      return (
                        <li key={String(row?.id || `${tipo}-${valor}-${idx}`)}>
                          {nome ? `${nome}: ` : ''}{tipo} — {valor}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <GerenciarContatosClienteForm
                contatos={contatosViewForUi}
                onChange={applyContatosDraft}
                commitMode="draft"
                assertScopeCurrent={assertFormScopeCurrent}
                persistBusy={isSaving || saveMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="enderecos" className="m-0 mt-4" data-cadastro-commit="draft">
              {formData.locais_entrega === undefined && Array.isArray(locaisHttpView) && locaisHttpView.length > 0 && (
                <p className="mb-2 text-xs text-slate-600" data-fonte="cliente-locais-http" role="status">
                  Endereços lidos de cliente_locais (canônico). Editar assume o rascunho;
                  ao Salvar, grava via `/locais` (não no MASTER). Entrega ≠ cadastral.
                </p>
              )}
              <GerenciarEnderecosClienteForm
                enderecos={locaisViewForUi}
                onChange={applyEnderecosDraft}
                commitMode="draft"
                assertScopeCurrent={assertFormScopeCurrent}
                persistBusy={isSaving || saveMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-6 m-0 mt-4">
              <Card className={`border-2 ${
                calcularSituacaoCredito() === 'Desconhecido' ? 'border-amber-300 bg-amber-50' :
                calcularSituacaoCredito() === 'OK' ? 'border-green-300 bg-green-50' :
                calcularSituacaoCredito() === 'Alerta' ? 'border-orange-300 bg-orange-50' :
                'border-red-300 bg-red-50'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`w-6 h-6 ${
                      calcularSituacaoCredito() === 'Desconhecido' ? 'text-amber-700' :
                      calcularSituacaoCredito() === 'OK' ? 'text-green-600' :
                      calcularSituacaoCredito() === 'Alerta' ? 'text-orange-600' :
                      'text-red-600'
                    }`} />
                    <div>
                      <p className="font-semibold" data-credito-estado={calcularSituacaoCredito()}>
                        Situação de Crédito: {calcularSituacaoCredito()}
                      </p>
                      <p className="text-sm text-slate-600">
                        {formData.condicao_comercial === undefined || formData.condicao_comercial === null
                          ? 'Condição comercial ainda não recuperada nesta carga — sem inventar limite.'
                          : (
                            <>
                              Utilizado: R$ {(formData.condicao_comercial?.limite_credito_utilizado || 0).toLocaleString('pt-BR')}
                              {' '}de R$ {(formData.condicao_comercial?.limite_credito || 0).toLocaleString('pt-BR')}
                            </>
                          )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="limite_credito">Limite de Crédito (R$)</Label>
                  <Input
                    id="limite_credito"
                    type="number"
                    step="0.01"
                    value={formData.condicao_comercial?.limite_credito || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        limite_credito: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="limite_utilizado">Limite Utilizado (R$)</Label>
                  <Input
                    id="limite_utilizado"
                    type="number"
                    step="0.01"
                    value={formData.condicao_comercial?.limite_credito_utilizado || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        limite_credito_utilizado: parseFloat(e.target.value) || 0
                      }
                    })}
                    disabled
                  />
                  <p className="text-xs text-slate-500 mt-1">Calculado automaticamente</p>
                </div>

                <div>
                  <Label htmlFor="tabela_preco_id">Tabela de Preço</Label>
                  <Select
                    value={formData.condicao_comercial?.tabela_preco_id || ""}
                    onValueChange={(value) => {
                      const tabela = tabelasPreco.find(t => t.id === value);
                      setFormData({
                        ...formData,
                        condicao_comercial: {
                          ...formData.condicao_comercial,
                          tabela_preco_id: value,
                          tabela_preco_nome: tabela?.nome || ""
                        }
                      });
                    }}
                  >
                    <SelectTrigger id="tabela_preco_id">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {tabelasPreco.filter(t => t.ativo).map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome} ({t.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="forma_pagamento_padrao_id">Forma de Pagamento Padrão</Label>
                  <Select
                    value={formData.condicao_comercial?.forma_pagamento_padrao_id || ""}
                    onValueChange={(value) => {
                      const forma = formasPagamento.find(f => f.id === value);
                      setFormData({
                        ...formData,
                        condicao_comercial: {
                          ...formData.condicao_comercial,
                          forma_pagamento_padrao_id: value,
                          forma_pagamento_padrao_nome: forma?.descricao || ""
                        }
                      });
                    }}
                  >
                    <SelectTrigger id="forma_pagamento_padrao_id">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {formasPagamento.filter(f => f.ativa).map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="condicao_pagamento">Condição de Pagamento</Label>
                  <Select
                    value={formData.condicao_comercial?.condicao_pagamento || "À Vista"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        condicao_pagamento: value
                      }
                    })}
                  >
                    <SelectTrigger id="condicao_pagamento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="À Vista">À Vista</SelectItem>
                      <SelectItem value="7 dias">7 dias</SelectItem>
                      <SelectItem value="15 dias">15 dias</SelectItem>
                      <SelectItem value="30 dias">30 dias</SelectItem>
                      <SelectItem value="45 dias">45 dias</SelectItem>
                      <SelectItem value="60 dias">60 dias</SelectItem>
                      <SelectItem value="Parcelado">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="percentual_desconto">Desconto Padrão (%)</Label>
                  <Input
                    id="percentual_desconto"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.condicao_comercial?.percentual_desconto || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicao_comercial: {
                        ...formData.condicao_comercial,
                        percentual_desconto: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                {cliente?.id && (
                  <>
                    <div className="col-span-2 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Última Compra</p>
                          <p className="font-semibold">
                            {formData.data_ultima_compra
                              ? new Date(formData.data_ultima_compra).toLocaleDateString('pt-BR')
                              : '-'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Score de Pagamento</p>
                          <p className="text-2xl font-bold text-sky-600">
                            {formData.score_pagamento || 100}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Dias Atraso Médio</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {formData.dias_atraso_medio || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-6 m-0 mt-4">
              {ultimaNF && ultimaNF.length > 0 && (
                <Card className="bg-sky-50 border-sky-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-sky-900">Última Nota Fiscal Emitida</p>
                        <p className="text-xs text-sky-700">
                          NF-e {ultimaNF[0].numero}/{ultimaNF[0].serie} - {new Date(ultimaNF[0].data_emissao).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-sky-700">
                        R$ {(ultimaNF[0].valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regime_tributario">Regime Tributário</Label>
                  <Select
                    value={formData.configuracao_fiscal?.regime_tributario || undefined}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...(formData.configuracao_fiscal || {}),
                        regime_tributario: value
                      }
                    })}
                  >
                    <SelectTrigger id="regime_tributario" data-fiscal-carregado={formData.configuracao_fiscal === undefined ? 'nao' : 'sim'}>
                      <SelectValue placeholder={formData.configuracao_fiscal === undefined ? 'Não recuperado nesta carga' : 'Selecione...'} />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                      <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                      <SelectItem value="MEI">MEI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cfop_padrao_venda">CFOP Padrão Vendas</Label>
                  <Input
                    id="cfop_padrao_venda"
                    value={formData.configuracao_fiscal?.cfop_padrao_venda || "5102"}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        cfop_padrao_venda: e.target.value
                      }
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_contribuinte">Tipo de Contribuinte</Label>
                  <Select
                    value={formData.configuracao_fiscal?.tipo_contribuinte || "1 - Contribuinte"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        tipo_contribuinte: value
                      }
                    })}
                  >
                    <SelectTrigger id="tipo_contribuinte">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="1 - Contribuinte">1 - Contribuinte ICMS</SelectItem>
                      <SelectItem value="2 - Isento">2 - Isento</SelectItem>
                      <SelectItem value="9 - Não Contribuinte">9 - Não Contribuinte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isento_icms"
                      checked={formData.configuracao_fiscal?.isento_icms || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracao_fiscal: {
                          ...formData.configuracao_fiscal,
                          isento_icms: e.target.checked
                        }
                      })}
                      className="rounded"
                    />
                    <Label htmlFor="isento_icms" className="font-normal cursor-pointer">
                      Isento ICMS
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isento_ipi"
                      checked={formData.configuracao_fiscal?.isento_ipi || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuracao_fiscal: {
                          ...formData.configuracao_fiscal,
                          isento_ipi: e.target.checked
                        }
                      })}
                      className="rounded"
                    />
                    <Label htmlFor="isento_ipi" className="font-normal cursor-pointer">
                      Isento IPI
                    </Label>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes_fiscais">Observações Fiscais</Label>
                  <Textarea
                    id="observacoes_fiscais"
                    value={formData.configuracao_fiscal?.observacoes_fiscais || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuracao_fiscal: {
                        ...formData.configuracao_fiscal,
                        observacoes_fiscais: e.target.value
                      }
                    })}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="m-0 mt-4">
              {cliente?.id ? (
                <div className="space-y-6">
                  <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}>
                    <ResumoHistorico clienteId={clienteBoundId || cliente?.id} />
                  </Suspense>
                  <Suspense fallback={<div className="h-16 animate-pulse bg-slate-100 rounded" />}>
                    <HistoricoOrigemCliente clienteId={clienteBoundId || cliente?.id} compact={false} />
                  </Suspense>
                  <Suspense fallback={<div className="h-24 rounded-xl bg-white/40 backdrop-blur animate-pulse" />}>
                    <TimelineCliente clienteId={clienteBoundId || cliente?.id} showFilters={true} />
                  </Suspense>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Salve o cliente primeiro para ver o histórico</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="anexos" className="space-y-6 m-0 mt-4">
              {isHttpBackendMode && (
                <p
                  className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                  data-fonte="documentos-limitacao-http"
                  data-pendencia="documentos-anexos-bff"
                  role="status"
                >
                  Documento de identificação (CPF/CNPJ) fica em Dados Gerais / MASTER.
                  Anexos adicionais (`documentos[]`) ≠ ModeloDocumento cadastro; HTTP MASTER
                  fail-closed até storage canônico BFF — sem DocumentosCliente paralelo.
                </p>
              )}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Paperclip className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 mb-2">Upload de Documentos</p>
                <p className="text-sm text-slate-500 mb-4">
                  Arraste arquivos ou clique para fazer upload
                </p>
                <Button variant="outline" disabled={isHttpBackendMode} title={isHttpBackendMode ? 'Anexos HTTP aguardam BFF' : undefined}>
                  Selecionar Arquivos
                </Button>
              </div>

              {formData.documentos && formData.documentos.length > 0 && (
                <div className="space-y-2">
                  {formData.documentos.map((doc, index) => (
                    <Card key={index} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-sky-600" />
                            <div>
                              <p className="font-medium">{doc.nome_arquivo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{doc.tipo}</Badge>
                                {doc.data_upload && (
                                  <span className="text-xs text-slate-500">
                                    {new Date(doc.data_upload).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {doc.upload_por && (
                                  <span className="text-xs text-slate-500">
                                    por {doc.upload_por}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {doc.url_arquivo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(doc.url_arquivo, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-white">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onCloseNorm}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0 overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  );
}

CadastroClienteCompleto.displayName = 'CadastroClienteCompleto';
CadastroClienteCompleto.isSelfManagedCadastro = true;
