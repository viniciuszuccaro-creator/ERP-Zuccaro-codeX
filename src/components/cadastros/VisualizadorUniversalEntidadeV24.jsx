/**
 * VisualizadorUniversalEntidadeV24 — V34 ESTAVEL
 * - Lista NUNCA desaparece durante sort/paginação/exclusão (placeholderData + lastGoodData guard)
 * - Novos registros aparecem no topo imediatamente após salvar (staleTime: 0)
 * - 1ª coluna sempre mostra o melhor campo de nome disponível (getDisplayValue fallback)
 * - Erros mantêm cache visível com banner discreto
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import useEntityCounts, { SIMPLE_CATALOG } from "@/components/lib/useEntityCounts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Search, Edit, Trash2, Plus, RefreshCw, AlertCircle, X
} from "lucide-react";
import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";
import CadastroFornecedorCompleto from "@/components/cadastros/CadastroFornecedorCompleto";
import TransportadoraForm from "@/components/cadastros/TransportadoraForm";
import ColaboradorForm from "@/components/rh/ColaboradorForm";
import RepresentanteFormCompleto from "@/components/cadastros/RepresentanteFormCompleto";
import ContatoB2BForm from "@/components/cadastros/ContatoB2BForm";
import SegmentoClienteForm from "@/components/cadastros/SegmentoClienteForm";
import RegiaoAtendimentoForm from "@/components/cadastros/RegiaoAtendimentoForm";

// ─── constantes visuais ───────────────────────────────────────────────────────
const STATUS_COLORS = {
  Ativo:"bg-green-100 text-green-700 border-green-200",
  Ativa:"bg-green-100 text-green-700 border-green-200",
  Aprovado:"bg-green-100 text-green-700 border-green-200",
  OK:"bg-green-100 text-green-700 border-green-200",
  Pago:"bg-green-100 text-green-700 border-green-200",
  Recebido:"bg-green-100 text-green-700 border-green-200",
  "Em Análise":"bg-blue-100 text-blue-700 border-blue-200",
  Pendente:"bg-yellow-100 text-yellow-700 border-yellow-200",
  Prospect:"bg-yellow-100 text-yellow-700 border-yellow-200",
  Alerta:"bg-yellow-100 text-yellow-700 border-yellow-200",
  Inativo:"bg-slate-100 text-slate-500 border-slate-200",
  Inativa:"bg-slate-100 text-slate-500 border-slate-200",
  Bloqueado:"bg-red-100 text-red-700 border-red-200",
  Cancelado:"bg-red-100 text-red-700 border-red-200",
  Atrasado:"bg-red-100 text-red-700 border-red-200",
  Descontinuado:"bg-orange-100 text-orange-700 border-orange-200",
};
const STATUS_FIELDS = new Set(["status","status_fornecedor","status_cliente","situacao","situacao_credito","status_fiscal_receita"]);
const BOOL_FIELDS   = new Set(["ativo","ativa","habilitado","compartilhado_grupo","ativo_sistema","principal","ativado"]);
const DATE_FIELDS   = new Set(["created_date","updated_date","data_admissao","data_nascimento","data_vencimento","data_validade","ultima_compra","data_emissao","data_pedido","cnh_validade","data_aprovacao","data_inicio","data_fim"]);
const MONEY_FIELDS  = new Set(["salario","preco_venda","custo_aquisicao","custo_medio","valor_frete","orcamento_mensal","limite_credito","valor_total","valor","valor_minimo","valor_maximo","percentual_comissao"]);
const PAGE_SIZES = [10, 20, 50, 100];
const UNSORTABLE_BACKEND = new Set(["contatos","documentos","locais_entrega","lotes","itens"]);
const ENTITY_CONTEXT_FIELD = { Fornecedor: "empresa_dona_id", Transportadora: "empresa_dona_id", Colaborador: "empresa_alocada_id" };
const SHARED_ENTITIES = new Set(["Cliente", "Fornecedor", "Transportadora"]);

const DEFAULT_FORM_COMPONENTS = {
  Cliente: CadastroClienteCompleto,
  Fornecedor: CadastroFornecedorCompleto,
  Transportadora: TransportadoraForm,
  Colaborador: ColaboradorForm,
  Representante: RepresentanteFormCompleto,
  ContatoB2B: ContatoB2BForm,
  SegmentoCliente: SegmentoClienteForm,
  RegiaoAtendimento: RegiaoAtendimentoForm,
};

const SELF_MANAGED_NAMES = new Set([
  "CadastroClienteCompleto","CadastroFornecedorCompleto","RepresentanteFormCompleto",
  "ProdutoFormV22_Completo","ProdutoFormCompleto","ProdutoForm",
]);

const FORM_ALIASES = [
  "item","data","initialData","defaultValues","record","entity","value",
  "cliente","fornecedor","colaborador","transportadora","representante",
  "contato","contatoB2B","segmento","segmentoCliente","regiao","regiaoAtendimento",
  "produto","servico","banco","conta","formaPagamento","centroCusto","planoContas",
  "planoDeContas","veiculo","motorista","departamento","cargo","turno",
  "empresa","grupo","grupoEmpresarial","grupoProduto","marca","kitProduto",
  "catalogoWeb","unidade","unidadeMedida","setor","setorAtividade","tabelaPreco",
  "tipoDespesa","moedaIndice","moeda","operadorCaixa","operador",
  "tabelaFiscal","condicaoComercial","centroResultado","centro",
  "localEstoque","local","tipoFrete","rotaPadrao","rota",
  "gateway","gatewayPagamento","configuracaoDespesaRecorrente","despesaRecorrente",
  "perfilAcesso","perfil","modeloDocumento","apiExterna",
  "webhook","chatbotIntent","chatbotCanal","jobAgendado","eventoNotificacao",
  // aliases extras para forms que usam nomes específicos (não camelCase da entidade)
  "evento",       // EventoNotificacaoForm usa { evento }
  "tabela",       // TabelaFiscalForm usa { tabela }
  "condicao",     // CondicaoComercialForm usa { condicao }
  "apiExternaForm", // cobertura extra
  "webhookForm",    // cobertura extra
];

// ─── getDisplayValue: mostra melhor valor disponível para cada célula ───────
// Para 1ª coluna: tenta todos os campos de nome se o campo configurado estiver vazio.
// Para demais colunas: tenta variantes comuns do nome do campo (snake_case, sem prefixo, etc.)
const LABEL_FALLBACKS = [
  // Campos de nome direto (prioridade máxima)
  'nome','nome_completo','razao_social','nome_fantasia',
  // Legado: campos não-padronizados (forms que não usam 'nome')
  'nome_do_grupo','nome_banco','nome_cargo','nome_turno','nome_grupo',
  'nome_marca','nome_rota','nome_modelo','nome_caixa','nome_segmento',
  'nome_regiao','nome_perfil','nome_kit','nome_setor','nome_departamento',
  'nome_tipo','nome_canal','nome_intent','nome_job','nome_webhook','nome_api',
  'nome_gateway','nome_forma','nome_centro','nome_plano','nome_local',
  // Campos descritivos (Serviço e TipoFrete usam 'descricao' como nome)
  'descricao','titulo','apelido','label','tag',
  // Identificadores (Banco usa codigo_banco, Unidade usa sigla)
  'sigla','codigo','codigo_banco','matricula','placa','cpf','cnpj',
  // Campos de moeda/índice
  'moeda','indice','simbolo','abreviacao',
  // Outros
  'tipo','categoria','modalidade','funcao','url','email','telefone',
];

function buildFieldVariants(field) {
  var variants = [field];
  // tira prefixos comuns: nome_banco → banco, tipo_regiao → regiao
  var parts = field.split('_');
  if (parts.length > 1) {
    variants.push(parts.slice(1).join('_'));
    variants.push(parts[0]);
  }
  // adiciona variante sem sufixo _id
  if (field.endsWith('_id')) variants.push(field.slice(0, -3));
  // fallback genérico de nome
  variants = variants.concat(['nome', 'descricao', 'titulo', 'sigla', 'codigo']);
  return variants;
}

function getDisplayValue(item, col, isFirstCol) {
  var v = item[col.field];
  if (v !== null && v !== undefined && v !== '') return v;
  // Para primeira coluna usa todos os LABEL_FALLBACKS
  if (isFirstCol) {
    for (var i = 0; i < LABEL_FALLBACKS.length; i++) {
      var f = LABEL_FALLBACKS[i];
      if (f !== col.field && item[f] != null && item[f] !== '') return item[f];
    }
    return v;
  }
  // Para demais colunas tenta variantes do nome do campo
  var variants = buildFieldVariants(col.field);
  for (var j = 0; j < variants.length; j++) {
    var vf = variants[j];
    if (vf !== col.field && item[vf] != null && item[vf] !== '') return item[vf];
  }
  return v;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtValue(value, col, extraColors) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-300 text-xs">—</span>;
  }
  const allColors = Object.assign({}, STATUS_COLORS, extraColors);
  if (BOOL_FIELDS.has(col.field)) {
    return value
      ? <Badge variant="outline" className="text-xs rounded-sm bg-green-100 text-green-700 border-green-200">Sim</Badge>
      : <Badge variant="outline" className="text-xs rounded-sm bg-slate-100 text-slate-500 border-slate-200">Não</Badge>;
  }
  if (STATUS_FIELDS.has(col.field) && typeof value === "string") {
    const cls = allColors[value] || "bg-slate-100 text-slate-600 border-slate-200";
    return <Badge variant="outline" className={"text-xs rounded-sm " + cls}>{value}</Badge>;
  }
  if (DATE_FIELDS.has(col.field) || col.type === "date") {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    } catch (_) {}
  }
  if (MONEY_FIELDS.has(col.field) || col.type === "currency") {
    const n = Number(value);
    if (!isNaN(n)) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (col.type === "number") {
    const n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("pt-BR");
  }
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "object") return Array.isArray(value) ? "[" + value.length + "]" : "–";
  return String(value).substring(0, 130);
}

function buildFormProps(editItem, onClose, onSubmit) {
  const base = {
    onClose, onSave: onClose, onSuccess: onClose,
    onOpenChange: function(v) { if (!v) onClose(); },
    isOpen: true, open: true, windowMode: true, onSubmit,
  };
  if (!editItem) return base;
  const aliases = {};
  FORM_ALIASES.forEach(function(a) { aliases[a] = editItem; });
  return Object.assign({}, base, aliases, { id: editItem.id });
}

function invalidateAll(qc, entity) {
  // refetchType: 'all' garante que queries inativas (ex.: troca de aba) também revalidam
  qc.invalidateQueries({ queryKey: ["viz-v33", entity] });
  qc.invalidateQueries({ queryKey: ["entityCounts_v5"] });
  qc.invalidateQueries({ queryKey: ["cadastros-all-counts-v5"] });
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function VisualizadorUniversalEntidadeV24({
  nomeEntidade, tituloDisplay, icone: IconeProp,
  camposPrincipais, componenteEdicao: FormComponentProp,
  windowMode, entityName, columns,
  pageSize: pageSizeProp,
  statusColors: extraColors,
  startWithForm = false,
}) {
  const ENTITY   = nomeEntidade || entityName || "";
  const TITULO   = tituloDisplay || ENTITY;
  const FormComponent = FormComponentProp || DEFAULT_FORM_COMPONENTS[ENTITY] || null;
  const isSimple = SIMPLE_CATALOG.has(ENTITY);
  const _camposPrincipais = camposPrincipais || [];
  const _extraColors      = extraColors || {};
  const _pageSizeProp     = pageSizeProp || 20;

  const isSelfManaged = useMemo(function() {
    if (!FormComponent) return false;
    const name = FormComponent.displayName || FormComponent.name || "";
    return SELF_MANAGED_NAMES.has(name);
  }, [FormComponent]);

  const queryClient = useQueryClient();
  const {
    empresaAtual,
    grupoAtual,
    empresasDoGrupo,
    createInContext,
    updateInContext,
    deleteInContext
  } = useContextoVisual();
  const { canCreate, canEdit, canDelete, hasPermission } = usePermissions();
  const empresaId = (empresaAtual && empresaAtual.id) || null;
  const groupId   = (grupoAtual   && grupoAtual.id)   || null;
  const contextoValido = !!(empresaId || groupId || isSimple);
  const canViewCadastro = hasPermission("Cadastros", ENTITY, "visualizar") || hasPermission("Cadastros", null, "visualizar");
  const canCreateCadastro = canCreate("Cadastros", ENTITY) || canCreate("Cadastros", null);
  const canEditCadastro = canEdit("Cadastros", ENTITY) || canEdit("Cadastros", null);
  const canDeleteCadastro = canDelete("Cadastros", ENTITY) || canDelete("Cadastros", null);

  const COLUMNS = useMemo(function() {
    if (columns && columns.length > 0) return columns;
    if (_camposPrincipais.length > 0) {
      return _camposPrincipais.map(function(c) {
        return {
          field: c,
          label: c.replace(/_/g, " ").replace(/\b\w/g, function(x) { return x.toUpperCase(); }),
          sortable: true,
        };
      });
    }
    return [{ field: "nome", label: "Nome", sortable: true }, { field: "status", label: "Status", sortable: false }];
  }, [JSON.stringify(columns), JSON.stringify(_camposPrincipais)]); // eslint-disable-line

  // ── estado ──────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState("updated_date");
  const [sortDir,   setSortDir]   = useState("desc");
  const [search,    setSearch]    = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(_pageSizeProp);

  const [showForm,      setShowForm]      = useState(Boolean(startWithForm && FormComponent));
  const [editItem,      setEditItem]      = useState(null);
  const [formKey,       setFormKey]       = useState(0);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editError,     setEditError]     = useState(null);
  const [isSaving,      setIsSaving]      = useState(false);

  const [selectedIds,   setSelectedIds]   = useState(function() { return new Set(); });
  const [crossPageAll,  setCrossPageAll]  = useState(false);
  const [deselectedIds, setDeselectedIds] = useState(function() { return new Set(); });

  const lastGoodData  = useRef([]);
  const everLoadedRef = useRef(false);

  // Debounce busca
  const debRef = useRef(null);
  useEffect(function() {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(function() { setDebouncedSearch(search); setPage(1); }, 350);
    return function() { clearTimeout(debRef.current); };
  }, [search]);

  // Contagem
  const { counts, isLoading: countsLoading } = useEntityCounts(ENTITY ? [ENTITY] : []);
  const totalCount = Number((counts && counts[ENTITY]) || 0);

  const buildAuditPayload = useCallback(function(extra) {
    return Object.assign({
      origem: "VisualizadorUniversalEntidadeV24",
      entidade: ENTITY,
      titulo: TITULO,
      contexto_valido: contextoValido,
      groupId: groupId || null,
      empresaId: empresaId || null,
      permissao_visualizar: canViewCadastro,
      permissao_criar: canCreateCadastro,
      permissao_editar: canEditCadastro,
      permissao_excluir: canDeleteCadastro,
      total_conhecido: totalCount
    }, extra || {});
  }, [ENTITY, TITULO, contextoValido, groupId, empresaId, canViewCadastro, canCreateCadastro, canEditCadastro, canDeleteCadastro, totalCount]);

  const auditCadastroEvent = useCallback(async function(acao, descricao, extra) {
    try {
      const payload = buildAuditPayload(extra);
      const operador = await base44.auth.me().catch(function() { return null; });
      await createInContext("AuditLog", {
        usuario: operador?.full_name || operador?.email || "Usuario local",
        usuario_id: operador?.id || null,
        acao,
        modulo: "Cadastros Gerais",
        tipo_auditoria: "cadastro",
        entidade: ENTITY,
        descricao,
        empresa_id: empresaId || null,
        group_id: groupId || null,
        grupo_id: groupId || null,
        dados_anteriores: payload.dados_anteriores || payload.antes || null,
        dados_novos: payload.dados_novos || payload.depois || payload,
        data_hora: new Date().toISOString(),
        sucesso: typeof payload.sucesso === "boolean" ? payload.sucesso : (acao !== "Bloqueio" && acao !== "Falha")
      });
    } catch (_) {}
  }, [ENTITY, empresaId, groupId, createInContext, buildAuditPayload]);


  const skip = (page - 1) * pageSize;

  // Filtro limpo: backend expande empresa_id ou group_id para todos os campos
  const readFilter = useMemo(function() {
    if (isSimple && !groupId && !empresaId) return {};
    const ctxCampo = ENTITY_CONTEXT_FIELD[ENTITY] || "empresa_id";
    const orConds = [];
    if (empresaId) {
      orConds.push({ [ctxCampo]: empresaId });
      if (ENTITY === "Cliente") {
        orConds.push({ empresa_dona_id: empresaId }, { empresas_compartilhadas_ids: { $in: [empresaId] } });
      } else if (SHARED_ENTITIES.has(ENTITY)) {
        orConds.push({ empresas_compartilhadas_ids: { $in: [empresaId] } });
      }
    }
    if (groupId) {
      orConds.push({ group_id: groupId });
      if (!empresaId && Array.isArray(empresasDoGrupo) && empresasDoGrupo.length) {
        const ids = empresasDoGrupo.map(function(e) { return e.id; }).filter(Boolean);
        if (ids.length) {
          if (ENTITY === "Cliente") {
            orConds.push({ empresa_id: { $in: ids } }, { empresa_dona_id: { $in: ids } }, { empresas_compartilhadas_ids: { $in: ids } });
          } else if (ENTITY === "Fornecedor" || ENTITY === "Transportadora") {
            orConds.push({ empresa_dona_id: { $in: ids } }, { empresas_compartilhadas_ids: { $in: ids } });
          } else if (ENTITY === "Colaborador") {
            orConds.push({ empresa_alocada_id: { $in: ids } });
          } else {
            orConds.push({ [ctxCampo]: { $in: ids } });
          }
        }
      }
    }
    return orConds.length ? { $or: orConds } : {};
  }, [ENTITY, isSimple, empresaId, groupId, empresasDoGrupo]);

  const backendSortField = UNSORTABLE_BACKEND.has(sortField) ? "updated_date" : sortField;
  const backendSortDir   = sortDir;

  const queryKey = useMemo(
    function() { return ["viz-v33", ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId]; },
    [ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId]
  );

  // ── query principal ──────────────────────────────────────────────────────────
  // placeholderData garante que a lista NÃO desaparece durante sort/paginação/exclusão
  const { data: rawItems, isFetching, isError, status } = useQuery({
    queryKey: queryKey,
    queryFn: async function() {
      if (!ENTITY) return [];
      const res = await base44.functions.invoke("entityListSorted", {
        entityName: ENTITY,
        filter: readFilter,
        search: debouncedSearch && debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
        sortField: backendSortField,
        sortDirection: backendSortDir,
        limit: pageSize,
        skip: skip,
      });
      return Array.isArray(res && res.data) ? res.data : [];
    },
    staleTime: 0,
    gcTime: 300000,
    retry: 2,
    retryDelay: function(attempt) { return Math.min(500 * (attempt + 1), 2000); },
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    placeholderData: function(prev) { return prev !== undefined ? prev : []; },
    enabled: !!ENTITY && contextoValido && canViewCadastro,
  });

  // items: estabilidade total — nunca desaparece durante sort/paginação/exclusão
  const items = useMemo(function() {
    const arr = Array.isArray(rawItems) ? rawItems : [];
    if (arr.length > 0) {
      lastGoodData.current = arr;
      everLoadedRef.current = true;
      return arr;
    }
    // CORREÇÃO: cobre janela entre queryKey-change e isFetching=true (status='pending')
    // Mostra lastGoodData em QUALQUER estado de transição para evitar lista sumir
    if (lastGoodData.current.length > 0) {
      // Ainda carregando (fetch em progresso ou em fila)
      if (isFetching || status === 'pending') return lastGoodData.current;
      // Erro temporário: mantém cache
      if (isError) return lastGoodData.current;
      // status='success' + arr=[] → genuinamente vazio (ex: filtro sem resultados)
      // Não retorna lastGoodData para mostrar estado vazio real
    }
    if (isError && lastGoodData.current.length === 0) return [];
    // Fetch completo e retornou [] genuíno
    everLoadedRef.current = true;
    lastGoodData.current = [];
    return [];
  }, [rawItems, isFetching, isError, status]);

  // Reset do cache quando muda de entidade, empresa, grupo ou busca
  // NÃO reseta ao mudar sort/page para manter estabilidade visual
  useEffect(function() {
    lastGoodData.current = [];
    everLoadedRef.current = false;
    setPage(1);
  }, [ENTITY, empresaId, groupId, debouncedSearch]);

  // Subscribe para invalidar quando houver mudanças na entidade
  useEffect(function() {
    if (!ENTITY) return;
    const api = base44.entities && base44.entities[ENTITY];
    if (!api || !api.subscribe) return;
    const unsub = api.subscribe(function() { invalidateAll(queryClient, ENTITY); });
    return function() { if (typeof unsub === "function") unsub(); };
  }, [ENTITY, queryClient]);

  // ── ordenação ────────────────────────────────────────────────────────────────
  const handleSort = useCallback(function(field) {
    setSortDir(function(prev) { return sortField === field ? (prev === "desc" ? "asc" : "desc") : "asc"; });
    setSortField(field);
    setPage(1);
  }, [sortField]);

  const handleSortDropdown = useCallback(function(value) {
    const idx = value.lastIndexOf("|");
    if (idx < 0) return;
    setSortField(value.slice(0, idx));
    setSortDir(value.slice(idx + 1));
    setPage(1);
  }, []);

  // ── formulário ───────────────────────────────────────────────────────────────
  const handleCloseForm = useCallback(function(wasSaved) {
    setShowForm(false);
    setEditItem(null);
    setEditError(null);
    if (wasSaved) {
      // Novos cadastros no topo: sort por updated_date desc, mantém lastGoodData
      setSortField("updated_date");
      setSortDir("desc");
      setPage(1);
    }
    // Invalida DEPOIS de ajustar o estado para garantir query correta no refetch
    setTimeout(function() { invalidateAll(queryClient, ENTITY); }, 50);
  }, [ENTITY, queryClient]);

  const handlePersistSubmit = useCallback(async function(formData) {
    if (!formData || !ENTITY) return;
    if (formData._action === "delete") {
      if (!canDeleteCadastro) {
        await auditCadastroEvent("Bloqueio", "Tentativa de excluir cadastro pelo formulario sem permissao", { registro_id: formData.id || null, permissao: `Cadastros.${ENTITY}.excluir`, sucesso: false });
        throw new Error("Sem permissao para excluir.");
      }
      if (formData.id) {
        try {
          await deleteInContext(ENTITY, formData.id);
          await auditCadastroEvent("Exclusao", "Cadastro excluido pelo formulario", { registro_id: formData.id, antes: editItem || formData, acao_sensivel: true });
        } catch (e) {
          await auditCadastroEvent("Falha", "Falha ao excluir cadastro pelo formulario", { registro_id: formData.id, erro: (e && e.message) || String(e), sucesso: false, acao_sensivel: true });
        }
      }
      handleCloseForm(true);
      return;
    }
    if (editItem && editItem.id && !canEditCadastro) {
      await auditCadastroEvent("Bloqueio", "Tentativa de editar cadastro sem permissao", { registro_id: editItem.id, permissao: `Cadastros.${ENTITY}.editar`, sucesso: false });
      throw new Error("Sem permissao para editar.");
    }
    if ((!editItem || !editItem.id) && !canCreateCadastro) {
      await auditCadastroEvent("Bloqueio", "Tentativa de criar cadastro sem permissao", { permissao: `Cadastros.${ENTITY}.criar`, sucesso: false });
      throw new Error("Sem permissao para criar.");
    }
    setIsSaving(true);
    try {
      const clean = Object.assign({}, formData);
      delete clean._action;
      if (!isSimple) {
        if (!clean.empresa_id && empresaId) clean.empresa_id = empresaId;
        if (!clean.group_id  && groupId)   clean.group_id   = groupId;
      }
      if (editItem && editItem.id) {
        await updateInContext(ENTITY, editItem.id, clean, ENTITY_CONTEXT_FIELD[ENTITY] || "empresa_id");
        await auditCadastroEvent("Edicao", "Cadastro editado pelo formulario", { registro_id: editItem.id, antes: editItem, depois: clean, acao_sensivel: true });
      } else {
        const created = await createInContext(ENTITY, clean, ENTITY_CONTEXT_FIELD[ENTITY] || "empresa_id");
        await auditCadastroEvent("Criacao", "Cadastro criado pelo formulario", { registro_id: (created && created.id) || clean.id || null, depois: clean, acao_sensivel: true });
      }
      handleCloseForm(true);
    } catch (e) {
      await auditCadastroEvent("Falha", "Falha ao salvar cadastro pelo formulario", { registro_id: (editItem && editItem.id) || formData.id || null, erro: (e && e.message) || String(e), sucesso: false, acao_sensivel: true });
      alert("Erro ao salvar: " + ((e && e.message) || String(e)));
    } finally {
      setIsSaving(false);
    }
  }, [ENTITY, editItem, empresaId, groupId, handleCloseForm, isSimple, canCreateCadastro, canEditCadastro, canDeleteCadastro, createInContext, updateInContext, deleteInContext, auditCadastroEvent]);

  const handleNewItem = useCallback(function() {
    if (!contextoValido) {
      auditCadastroEvent("Bloqueio", "Tentativa de criar cadastro sem contexto grupo/empresa", { motivo: "sem_contexto" });
      alert("Selecione um grupo ou empresa antes de criar.");
      return;
    }
    if (!canCreateCadastro) {
      auditCadastroEvent("Bloqueio", "Tentativa de criar cadastro sem permissao", { permissao: `Cadastros.${ENTITY}.criar` });
      alert("Sem permissao para criar.");
      return;
    }
    auditCadastroEvent("Visualizacao", "Formulario de criacao aberto", { origem: "VisualizadorUniversalEntidadeV24" });
    setEditItem(null);
    setEditError(null);
    setFormKey(function(k) { return k + 1; });
    setShowForm(true);
  }, [ENTITY, auditCadastroEvent, canCreateCadastro, contextoValido]);

  const handleEditItem = useCallback(function(item) {
    if (!item || !item.id) return;
    if (!contextoValido) {
      auditCadastroEvent("Bloqueio", "Tentativa de editar cadastro sem contexto grupo/empresa", { registro_id: item.id, motivo: "sem_contexto" });
      alert("Selecione um grupo ou empresa antes de editar.");
      return;
    }
    if (!canEditCadastro) {
      auditCadastroEvent("Bloqueio", "Tentativa de editar cadastro sem permissao", { registro_id: item.id, permissao: `Cadastros.${ENTITY}.editar` });
      alert("Sem permissao para editar.");
      return;
    }
    auditCadastroEvent("Visualizacao", "Formulario de edicao aberto", { registro_id: item.id, origem: "VisualizadorUniversalEntidadeV24" });
    setEditItem(JSON.parse(JSON.stringify(item)));
    setEditError(null);
    setIsLoadingEdit(false);
    setFormKey(function(k) { return k + 1; });
    setShowForm(true);
  }, [ENTITY, auditCadastroEvent, canEditCadastro, contextoValido]);

  const formProps = useMemo(
    function() { return buildFormProps(editItem, handleCloseForm, isSelfManaged ? handleCloseForm : handlePersistSubmit); },
    [editItem, handleCloseForm, isSelfManaged, handlePersistSubmit]
  );

  // ── exclusão unitária ────────────────────────────────────────────────────────
  const handleDelete = useCallback(async function(item) {
    const label = item.nome || item.razao_social || item.nome_completo || item.descricao || item.id;
    if (!window.confirm('Regra-Mae: confirma excluir "' + label + '" de ' + TITULO + '? Esta acao sensivel sera auditada.')) return;
    if (!contextoValido) {
      await auditCadastroEvent("Bloqueio", "Tentativa de excluir cadastro sem contexto grupo/empresa", { registro_id: item.id, motivo: "sem_contexto", sucesso: false, acao_sensivel: true });
      alert("Selecione um grupo ou empresa antes de excluir.");
      return;
    }
    if (!canDeleteCadastro) {
      await auditCadastroEvent("Bloqueio", "Tentativa de excluir cadastro sem permissao", { registro_id: item.id, permissao: `Cadastros.${ENTITY}.excluir`, sucesso: false, acao_sensivel: true });
      alert("Sem permissao para excluir.");
      return;
    }
    try {
      await deleteInContext(ENTITY, item.id);
      await auditCadastroEvent("Exclusao", "Cadastro excluido pela grade", { registro_id: item.id, antes: item, acao_sensivel: true });
    }
    catch (e) {
      await auditCadastroEvent("Falha", "Falha ao excluir cadastro pela grade", { registro_id: item.id, erro: (e && e.message) || String(e), sucesso: false, acao_sensivel: true });
      alert("Erro: " + ((e && e.message) || String(e)));
      return;
    }
    // Atualiza lastGoodData imediatamente (remove item deletado da lista visivel)
    lastGoodData.current = lastGoodData.current.filter(function(i) { return i.id !== item.id; });
    setSelectedIds(function(prev) { const n = new Set(prev); n.delete(item.id); return n; });
    if (items.length <= 1 && page > 1) setPage(function(p) { return Math.max(1, p - 1); });
    invalidateAll(queryClient, ENTITY);
  }, [ENTITY, TITULO, queryClient, items.length, page, canDeleteCadastro, contextoValido, deleteInContext, auditCadastroEvent]);

  // ── exclusão em massa ────────────────────────────────────────────────────────
  const handleDeleteSelected = useCallback(async function() {
    if (!contextoValido) {
      await auditCadastroEvent("Bloqueio", "Tentativa de exclusao em lote sem contexto grupo/empresa", { motivo: "sem_contexto", sucesso: false, acao_sensivel: true });
      alert("Selecione um grupo ou empresa antes de excluir.");
      return;
    }
    if (!canDeleteCadastro) {
      await auditCadastroEvent("Bloqueio", "Tentativa de exclusao em lote sem permissao", { permissao: `Cadastros.${ENTITY}.excluir`, sucesso: false, acao_sensivel: true });
      alert("Sem permissao para excluir.");
      return;
    }
    const effCount = crossPageAll
      ? Math.max(0, totalCount - deselectedIds.size)
      : selectedIds.size;
    if (effCount === 0) return;

    const msg = (crossPageAll && effCount > items.length)
      ? "Regra-Mae: isso ira excluir " + effCount + " registro(s) de " + TITULO + " permanentemente em todas as paginas. Esta acao sera auditada.\nDeseja continuar?"
      : "Regra-Mae: confirmar exclusao de " + effCount + " registro(s) de " + TITULO + "? Esta acao sera auditada.";
    if (!window.confirm(msg)) return;

    try {
      let idsToDelete = [];
      if (crossPageAll) {
        let skipAcc = 0;
        while (true) {
          const res = await base44.functions.invoke("entityListSorted", {
            entityName: ENTITY,
            filter: readFilter,
            sortField: "id", sortDirection: "asc",
            limit: 500, skip: skipAcc,
          });
          const arr = Array.isArray(res && res.data) ? res.data : [];
          if (!arr.length) break;
          arr.forEach(function(i) { if (i.id && !deselectedIds.has(i.id)) idsToDelete.push(i.id); });
          if (arr.length < 500) break;
          skipAcc += 500;
        }
      } else {
        idsToDelete = Array.from(selectedIds);
      }

      if (!idsToDelete.length) { alert("Nenhum registro encontrado para excluir."); return; }

      for (let i = 0; i < idsToDelete.length; i += 20) {
        await Promise.all(
          idsToDelete.slice(i, i + 20).map(function(id) {
            return deleteInContext(ENTITY, id).catch(function() {});
          })
        );
      }
      await auditCadastroEvent("Exclusao em lote", "Cadastros excluidos pela grade", {
        quantidade: idsToDelete.length,
        ids_amostra: idsToDelete.slice(0, 50),
        selecionou_todas_paginas: crossPageAll,
        acao_sensivel: true
      });
    } catch (e) {
      await auditCadastroEvent("Falha", "Falha na exclusao em lote pela grade", { erro: (e && e.message) || String(e), sucesso: false, acao_sensivel: true });
      alert("Erro ao excluir: " + ((e && e.message) || String(e)));
      return;
    }

    setSelectedIds(new Set());
    setDeselectedIds(new Set());
    setCrossPageAll(false);
    setPage(1);
    invalidateAll(queryClient, ENTITY);
  }, [ENTITY, TITULO, crossPageAll, totalCount, selectedIds, deselectedIds, readFilter, queryClient, items.length, deleteInContext, canDeleteCadastro, contextoValido, auditCadastroEvent]);

  // ── seleção ──────────────────────────────────────────────────────────────────
  const isItemSelected = useCallback(function(id) {
    return crossPageAll ? !deselectedIds.has(id) : selectedIds.has(id);
  }, [crossPageAll, deselectedIds, selectedIds]);

  const handleItemCheck = useCallback(function(id, checked) {
    if (crossPageAll) {
      setDeselectedIds(function(prev) {
        const n = new Set(prev);
        if (checked) n.delete(id); else n.add(id);
        return n;
      });
    } else {
      setSelectedIds(function(prev) {
        const n = new Set(prev);
        if (checked) n.add(id); else n.delete(id);
        return n;
      });
    }
  }, [crossPageAll]);

  const allPageSelected  = items.length > 0 && items.every(function(i) { return isItemSelected(i.id); });
  const somePageSelected = items.some(function(i) { return isItemSelected(i.id); });

  const handleToggleSelectPage = useCallback(function() {
    if (crossPageAll) {
      setDeselectedIds(function(prev) {
        const n = new Set(prev);
        if (allPageSelected) items.forEach(function(i) { n.add(i.id); });
        else items.forEach(function(i) { n.delete(i.id); });
        return n;
      });
    } else if (allPageSelected) {
      setSelectedIds(function(prev) { const n = new Set(prev); items.forEach(function(i) { n.delete(i.id); }); return n; });
    } else {
      setSelectedIds(function(prev) { const n = new Set(prev); items.forEach(function(i) { n.add(i.id); }); return n; });
    }
  }, [crossPageAll, allPageSelected, items]);

  const handleActivateCrossPage = useCallback(function() {
    setCrossPageAll(true); setDeselectedIds(new Set()); setSelectedIds(new Set());
  }, []);
  const handleCancelSelection = useCallback(function() {
    setCrossPageAll(false); setDeselectedIds(new Set()); setSelectedIds(new Set());
  }, []);

  function getSortIcon(field) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-slate-400" />;
    if (sortDir === "desc") return <ChevronDown className="w-3.5 h-3.5 text-blue-500" />;
    return <ChevronUp className="w-3.5 h-3.5 text-blue-500" />;
  }

  const effSelectedCount = crossPageAll ? Math.max(0, totalCount - deselectedIds.size) : selectedIds.size;
  const showCrossPageBanner = !crossPageAll && selectedIds.size > 0 && allPageSelected && totalCount > items.length;

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  if (!canViewCadastro) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Seu perfil nao tem permissao para visualizar {TITULO}.
        </div>
      </div>
    );
  }

  const renderTableBody = function() {
    // Skeleton apenas na carga inicial absoluta (nunca durante sort/paginação)
  const isInitialLoad = isFetching && !everLoadedRef.current && lastGoodData.current.length === 0;
    if (isInitialLoad) {
      return (
        <div className="space-y-1.5 p-3">
          {[...Array(8)].map(function(_, i) {
            return <Skeleton key={i} className={"h-8 rounded-sm " + (i % 3 === 0 ? "w-3/4" : "w-full")} />;
          })}
        </div>
      );
    }
    if (isError && items.length === 0 && !isFetching) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2">
          <AlertCircle className="w-7 h-7" />
          <span className="text-sm">Erro ao carregar dados.</span>
          <button
            className="text-xs underline text-red-400"
            onClick={function() { lastGoodData.current = []; everLoadedRef.current = false; invalidateAll(queryClient, ENTITY); }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    if (items.length === 0 && !isFetching) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <Search className="w-7 h-7 opacity-30" />
          <span className="text-sm">
            {debouncedSearch
              ? "Nenhum resultado para \"" + debouncedSearch + "\""
              : "Nenhum registro de " + TITULO}
          </span>
        </div>
      );
    }
    return (
      <table className="w-full text-sm table-auto">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
          <tr>
            <th className="px-3 py-2.5 text-center w-8">
              <input
                type="checkbox"
                ref={function(el) { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                checked={allPageSelected}
                onChange={handleToggleSelectPage}
                disabled={!contextoValido || !canDeleteCadastro}
                data-permission={`Cadastros.${ENTITY}.excluir`}
                data-sensitive="true"
                className="w-4 h-4 cursor-pointer accent-blue-600"
              />
            </th>
            {COLUMNS.map(function(col) {
              return (
                <th
                  key={col.field}
                  className={"px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap select-none" + (col.sortable !== false ? " cursor-pointer hover:bg-slate-100 transition-colors" : "")}
                  onClick={function() { if (col.sortable !== false) handleSort(col.field); }}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.sortable !== false && getSortIcon(col.field)}
                  </div>
                </th>
              );
            })}
            <th className="px-3 py-2.5 text-center w-20 font-semibold text-slate-600">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(function(item) {
            const checked = isItemSelected(item.id);
            return (
              <tr
                key={item.id}
                className={"transition-colors hover:bg-blue-50/30" + (checked ? " bg-blue-50/40" : "")}
              >
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={function(e) { handleItemCheck(item.id, e.target.checked); }}
                    disabled={!contextoValido || !canDeleteCadastro}
                    data-permission={`Cadastros.${ENTITY}.excluir`}
                    data-sensitive="true"
                    className="w-4 h-4 cursor-pointer accent-blue-600"
                  />
                </td>
                {COLUMNS.map(function(col, colIdx) {
                  return (
                    <td key={col.field} className="px-3 py-2 text-slate-600 max-w-[240px] truncate">
                      {fmtValue(getDisplayValue(item, col, colIdx === 0), col, _extraColors)}
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {FormComponent && (
                      <button
                        type="button"
                        onClick={function(e) { e.stopPropagation(); handleEditItem(item); }}
                        title="Editar"
                        disabled={isLoadingEdit || !canEditCadastro}
                        data-permission={`Cadastros.${ENTITY}.editar`}
                        data-sensitive="true"
                        className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                      >
                        {isLoadingEdit
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Edit className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={function() { handleDelete(item); }}
                      title="Excluir"
                      disabled={!contextoValido || !canDeleteCadastro}
                      data-permission={`Cadastros.${ENTITY}.excluir`}
                      data-sensitive="true"
                      className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const content = (
    <div className="flex flex-col h-full gap-2 min-h-0 w-full">

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-semibold text-slate-700 truncate max-w-[160px]">{TITULO}:</span>
          <Badge variant="outline" className="rounded-sm bg-blue-50 text-blue-700 border-blue-200 font-bold tabular-nums min-w-[32px] text-center">
            {(countsLoading && totalCount === 0)
              ? <span className="animate-pulse text-[10px]">···</span>
              : totalCount.toLocaleString("pt-BR")}
          </Badge>
        </div>

        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            className="pl-8 h-9 rounded-sm text-sm bg-white border-slate-200"
            data-permission={`Cadastros.${ENTITY}.visualizar`}
            data-action={`Cadastros.${ENTITY}.buscar`}
          />
          {search && (
            <button
              onClick={function() { setSearch(""); }}
              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              data-permission={`Cadastros.${ENTITY}.visualizar`}
              data-action={`Cadastros.${ENTITY}.limpar-busca`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={pageSize}
          onChange={function(e) { setPageSize(Number(e.target.value)); setPage(1); }}
          className="border border-slate-200 rounded-sm h-9 px-2 text-sm text-slate-700 bg-white cursor-pointer shrink-0"
          data-permission={`Cadastros.${ENTITY}.visualizar`}
          data-action={`Cadastros.${ENTITY}.alterar-paginacao`}
        >
          {PAGE_SIZES.map(function(ps) { return <option key={ps} value={ps}>{ps}/pág</option>; })}
        </select>

        <select
          value={sortField + "|" + sortDir}
          onChange={function(e) { handleSortDropdown(e.target.value); }}
          className="border border-slate-200 rounded-sm h-9 px-2 text-sm text-slate-700 bg-white cursor-pointer shrink-0"
          data-permission={`Cadastros.${ENTITY}.visualizar`}
          data-action={`Cadastros.${ENTITY}.ordenar`}
        >
          <option value="updated_date|desc">↓ Mais Recentes</option>
          <option value="updated_date|asc">↑ Mais Antigos</option>
          <option value="created_date|desc">↓ Criação (novo)</option>
          <option value="created_date|asc">↑ Criação (antigo)</option>
          {COLUMNS.filter(function(c) { return c.sortable !== false && c.field !== "updated_date" && c.field !== "created_date"; })
            .flatMap(function(c) {
              return [
                <option key={c.field + "|asc"}  value={c.field + "|asc"}>{c.label} ↑</option>,
                <option key={c.field + "|desc"} value={c.field + "|desc"}>{c.label} ↓</option>,
              ];
            })}
        </select>

        <button
          type="button"
          onClick={function() { lastGoodData.current = []; everLoadedRef.current = false; invalidateAll(queryClient, ENTITY); }}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-sm bg-white hover:bg-slate-50 shrink-0"
          title="Recarregar"
          data-permission={`Cadastros.${ENTITY}.visualizar`}
          data-action={`Cadastros.${ENTITY}.recarregar`}
        >
          <RefreshCw className={"w-4 h-4 " + (isFetching ? "animate-spin text-blue-500" : "text-slate-500")} />
        </button>

        {FormComponent && (
          <Button
            size="sm"
            onClick={handleNewItem}
            disabled={!contextoValido || !canCreateCadastro}
            className="h-9 rounded-sm gap-1 shrink-0"
            data-permission={`Cadastros.${ENTITY}.criar`}
            data-action={`Cadastros.${ENTITY}.criar`}
            data-sensitive="true"
          >
            <Plus className="w-4 h-4" /> Novo
          </Button>
        )}

        {effSelectedCount > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={!contextoValido || !canDeleteCadastro}
            className="h-9 rounded-sm gap-1 shrink-0"
            data-permission={`Cadastros.${ENTITY}.excluir`}
            data-action={`Cadastros.${ENTITY}.excluir-selecionados`}
            data-sensitive="true"
          >
            <Trash2 className="w-4 h-4" />
            Excluir {(effSelectedCount >= totalCount && totalCount > 0) ? "TODOS" : effSelectedCount}
          </Button>
        )}
      </div>

      {!contextoValido && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-xs text-amber-800 shrink-0">
          Selecione um grupo ou empresa para carregar, criar ou editar este cadastro no escopo correto.
        </div>
      )}

      {/* Banner cross-page */}
      {showCrossPageBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-1.5 text-xs text-amber-800 flex items-center gap-2 flex-wrap shrink-0">
          <span className="font-medium">{selectedIds.size} selecionados nesta página.</span>
          <button
            onClick={handleActivateCrossPage}
            className="text-blue-600 hover:text-blue-800 underline font-semibold"
            data-permission={`Cadastros.${ENTITY}.visualizar`}
            data-action={`Cadastros.${ENTITY}.selecionar-todos`}
          >
            Selecionar todos os {totalCount} registros
          </button>
          <button
            onClick={handleCancelSelection}
            className="ml-auto text-slate-500 underline"
            data-action={`Cadastros.${ENTITY}.cancelar-selecao`}
          >Cancelar</button>
        </div>
      )}
      {crossPageAll && (
        <div className="bg-blue-50 border border-blue-200 rounded-sm px-3 py-1.5 text-xs text-blue-700 flex items-center gap-2 flex-wrap shrink-0">
          <span>
            {deselectedIds.size > 0
              ? "✓ " + effSelectedCount + " de " + totalCount + " selecionados (" + deselectedIds.size + " desmarcado" + (deselectedIds.size > 1 ? "s" : "") + ")"
              : "✓ Todos os " + totalCount + " registros selecionados"}
          </span>
          <button
            onClick={handleCancelSelection}
            className="ml-auto text-blue-500 underline"
            data-action={`Cadastros.${ENTITY}.cancelar-selecao`}
          >Cancelar seleção</button>
        </div>
      )}

      {/* Tabela */}
      <div className="flex-1 overflow-auto rounded-sm border border-slate-200 bg-white min-h-0 relative">
        {isFetching && items.length > 0 && (
          <div className="absolute top-0 right-0 z-20 bg-blue-500/10 text-blue-600 text-[10px] px-2 py-0.5 flex items-center gap-1 rounded-bl">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> atualizando…
          </div>
        )}
        {isError && items.length > 0 && (
          <div className="absolute top-0 right-0 z-20 bg-red-500/10 text-red-600 text-[10px] px-2 py-0.5 flex items-center gap-1 rounded-bl">
            <AlertCircle className="w-2.5 h-2.5" /> erro — exibindo cache
          </div>
        )}
        {renderTableBody()}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-xs text-slate-500 shrink-0 flex-wrap gap-1">
        <span>Pág. {page} · {items.length} exibidos · {totalCount} total</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={function() { setPage(1); }}
            disabled={page === 1 || isFetching}
            className="h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40"
            data-action={`Cadastros.${ENTITY}.primeira-pagina`}
          >«</button>
          <button
            type="button"
            onClick={function() { setPage(function(p) { return Math.max(1, p - 1); }); }}
            disabled={page === 1 || isFetching}
            className="h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40"
            data-action={`Cadastros.${ENTITY}.pagina-anterior`}
          >← Ant.</button>
          <span className="flex items-center justify-center h-7 px-2 border border-slate-200 rounded-sm bg-white font-semibold text-slate-700">{page}</span>
          <button
            type="button"
            onClick={function() { setPage(function(p) { return p + 1; }); }}
            disabled={items.length < pageSize || isFetching}
            className="h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40"
            data-action={`Cadastros.${ENTITY}.proxima-pagina`}
          >Próx. →</button>
        </div>
      </div>

      {/* Modal formulário */}
      {FormComponent && showForm && (
        <React.Fragment>
          <div className="fixed inset-0 z-[1099] bg-black/50" onClick={function() { handleCloseForm(false); }} />
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-auto shadow-2xl pointer-events-auto flex flex-col"
              onClick={function(e) { e.stopPropagation(); }}
            >
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl shrink-0 z-10">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {(editItem && editItem.id) ? "Editar " + TITULO : "Novo " + TITULO}
                  </h2>
                  {editError && (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {editError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Salvando…
                    </span>
                  )}
                  {isLoadingEdit && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Carregando dados…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={function() { handleCloseForm(false); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    data-action={`Cadastros.${ENTITY}.fechar-formulario`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-auto">
                <FormComponent
                  key={"form-" + ENTITY + "-" + ((editItem && editItem.id) || "new") + "-" + formKey}
                  {...formProps}
                />
              </div>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col p-4 bg-white overflow-hidden">
        {IconeProp && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <IconeProp className="w-5 h-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">{TITULO}</h2>
          </div>
        )}
        <div className="flex-1 min-h-0">{content}</div>
      </div>
    );
  }
  return <div className="flex flex-col flex-1 min-h-0 h-full w-full">{content}</div>;
}
