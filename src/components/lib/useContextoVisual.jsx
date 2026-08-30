import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUser } from "./UserContext";
import useContextoGrupoEmpresa from "./useContextoGrupoEmpresa";
import { normalizeMultiempresaContext, validateMultiempresaContext } from "./contextoMultiempresaPolicy";

export function useContextoVisual() {
  const { user, isLoading: loadingUser } = useUser();
  const [contexto, setContexto] = useState(() => {
    try {
      return localStorage.getItem('contexto_atual') || 'empresa';
    } catch {
      return 'empresa';
    }
  });

  const {
    grupoAtual,
    empresaAtual: empresaContexto,
    empresasDoGrupo: empresasDoGrupoContexto,
    estaNoGrupo: estaNoGrupoContexto,
    estaEmEmpresa,
    isLoading: loadingContextoGrupoEmpresa
  } = useContextoGrupoEmpresa();

  // Sincroniza o contexto local com o contexto real (grupo/empresa)
  useEffect(() => {
    setContexto(estaNoGrupoContexto ? 'grupo' : 'empresa');
  }, [estaNoGrupoContexto]);

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
    staleTime: 300000,
  });

  const [empresaAtualId, setEmpresaAtualId] = useState(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState('todas');

  useEffect(() => {
    const storedEmpresaId = localStorage.getItem('empresa_atual_id');
    if (storedEmpresaId) {
      setEmpresaAtualId(storedEmpresaId);
    } else if (empresaContexto) {
      setEmpresaAtualId(empresaContexto.id);
    }
  }, [empresaContexto]);

  const empresaAtual = (contexto === 'grupo') ? null : (empresas.find(empresa => empresa.id === empresaAtualId) || empresaContexto || null);
  const empresasDoGrupo = empresas.filter(empresa => empresa.group_id === grupoAtual?.id);
  const estaNoGrupo = contexto === 'grupo';
  const contextoCanonico = normalizeMultiempresaContext({
    scopeType: contexto,
    groupId: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id,
    empresaId: empresaAtual?.id,
  });
  const validacaoContexto = validateMultiempresaContext(contextoCanonico);

  useEffect(() => {
            try {
              localStorage.setItem('contexto_atual', contexto);
            } catch (e) {
              console.warn('Erro ao salvar contexto:', e);
            }
          }, [contexto]);

          // Persistir o grupo atual para headers multi-tenant
          useEffect(() => {
            try {
              if (grupoAtual?.id) {
                localStorage.setItem('group_atual_id', grupoAtual.id);
              }
            } catch (e) {
              console.warn('Erro ao salvar grupo:', e);
            }
          }, [grupoAtual?.id]);

  const adaptarMenuPorContexto = (menuItems) => {
    if (!user) return menuItems;

    if (contexto === 'grupo') {
      return menuItems.map(item => ({
        ...item,
        destacado: ['Dashboard Corporativo', 'Gestão de Empresas', 'Relatórios e Análises'].includes(item.title)
      }));
    }

    return menuItems.map(item => ({
      ...item,
      destacado: ['Comercial e Vendas', 'Produção e Manufatura', 'Expedição e Logística'].includes(item.title)
    }));
  };

  const obterSugestoesNavegacao = () => {
    return [];
  };

  // Compatibilidade: se receber array -> filtra local; se receber string -> delega para filterInContext (consulta server com ordenação)
  const filtrarPorContexto = (arg, campo = 'empresa_id', maybeOrder, maybeLimit) => {
    // Caso 1: entidade (string) => usa backend ordenado e multiempresa
    if (typeof arg === 'string') {
      const entityName = arg;
      const criterios = typeof campo === 'object' ? campo : {};
      const order = typeof maybeOrder === 'string' ? maybeOrder : undefined;
      const limit = typeof maybeLimit === 'number' ? maybeLimit : undefined;
      const contextoCampo = typeof campo === 'string' ? campo : 'empresa_id';
      return filterInContext(entityName, criterios, order, limit, contextoCampo);
    }

    // Caso 2: lista local (array) => mantém filtro por contexto (retrocompatibilidade)
    const dados = Array.isArray(arg) ? arg : [];
    if (!dados || dados.length === 0) return [];

    if (estaNoGrupo) {
      if (filtroEmpresa !== 'todas') {
        return dados.filter(item => item[campo] === filtroEmpresa || item.group_id === grupoAtual?.id);
      }
      return dados.filter(item =>
        item.group_id === grupoAtual?.id ||
        empresasDoGrupo.some(emp => emp.id === item[campo])
      );
    }

    if (estaEmEmpresa && empresaAtual) {
      return dados.filter(item =>
        item[campo] === empresaAtual.id ||
        (item.group_id && item.documento_grupo_id && item[campo] === empresaAtual.id)
      );
    }

    return dados;
  };

  const obterLabelOrigem = (item) => {
    if (!item) return '-';
    if (item.origem === 'grupo') return 'Grupo';
    if (item.empresa_id) {
      const empresa = empresasDoGrupo.find(e => e.id === item.empresa_id);
      return empresa?.nome_fantasia || empresa?.razao_social || item.empresa_id;
    }
    return '-';
  };

  const obterLabelEmpresa = (item) => {
    if (!item) return '-';
    if (item.origem === 'grupo' && item.rateado_para_empresas) return 'Grupo (distribuído)';
    if (item.origem === 'grupo' && !item.rateado_para_empresas) return 'Grupo (apenas grupo)';
    if (item.empresa_id) {
      const empresa = empresasDoGrupo.find(e => e.id === item.empresa_id);
      return empresa?.nome_fantasia || empresa?.razao_social || '-';
    }
    return '-';
  };

  const obterCorOrigem = (item) => {
    if (!item) return 'bg-slate-100 text-slate-700';
    if (item.origem === 'grupo') return 'bg-blue-100 text-blue-700';
    return 'bg-purple-100 text-purple-700';
  };

  const temDistribuicao = (item) => {
    return item?.rateado_para_empresas === true && 
           item?.distribuicao_realizada && 
           item.distribuicao_realizada.length > 0;
  };

  const obterStatusDistribuicao = (item) => {
    if (!temDistribuicao(item)) return null;
    const distribuicao = item.distribuicao_realizada;
    const todosPagos = distribuicao.every(d => d.status === 'Pago' || d.status === 'Recebido');
    const algunsPagos = distribuicao.some(d => d.status === 'Pago' || d.status === 'Recebido');
    if (todosPagos) return 'Total';
    if (algunsPagos) return 'Parcial';
    return 'Pendente';
  };

  const obterPercentualPago = (item) => {
    if (!temDistribuicao(item)) return 0;
    const distribuicao = item.distribuicao_realizada;
    const totalPago = distribuicao.reduce((sum, d) => {
      if (d.status === 'Pago' || d.status === 'Recebido') return sum + d.valor;
      return sum;
    }, 0);
    const total = distribuicao.reduce((sum, d) => sum + d.valor, 0);
    return total > 0 ? (totalPago / total) * 100 : 0;
  };

  const adicionarColunasContexto = (dados) => {
    if (!dados) return [];
    return dados.map(item => ({
      ...item,
      _origem_label: obterLabelOrigem(item),
      _empresa_label: obterLabelEmpresa(item),
      _origem_cor: obterCorOrigem(item),
      _tem_distribuicao: temDistribuicao(item),
      _status_distribuicao: obterStatusDistribuicao(item),
      _percentual_pago: obterPercentualPago(item)
    }));
  };

  const alternarContexto = () => {
    setContexto(prevContexto => prevContexto === 'empresa' ? 'grupo' : 'empresa');
  };

  const selecionarEmpresa = (empresaId) => {
    setEmpresaAtualId(empresaId);
    try {
      localStorage.setItem('empresa_atual_id', empresaId);
    } catch (e) {
      console.warn('Erro ao salvar empresa:', e);
    }
  };

  // Helpers: multiempresa stamping and server-side filter
  const getFiltroContexto = (campo = 'empresa_id', incluirGrupo = false) => {
    const filtro = {};
    if (!validacaoContexto.valid) return filtro;
    if (incluirGrupo) filtro.group_id = contextoCanonico.groupId;
    if (contextoCanonico.scopeType === 'grupo') {
      if (filtroEmpresa !== 'todas') filtro[campo] = filtroEmpresa;
    } else {
      filtro[campo] = contextoCanonico.empresaId;
    }
    return filtro;
  };

  const carimbarContexto = (dados, campo = 'empresa_id') => {
    if (!validacaoContexto.valid) {
      throw new Error(validacaoContexto.error);
    }
    return {
      ...dados,
      ...(!dados?.group_id ? { group_id: contextoCanonico.groupId } : {}),
      ...((contextoCanonico.scopeType === 'empresa') && !dados?.[campo] ? { [campo]: contextoCanonico.empresaId } : {}),
    };
  };

  // Create helpers that always stamp context
  const MODULE_BY_ENTITY = {
    Cliente: 'CRM', Oportunidade: 'CRM', Interacao: 'CRM', Pedido: 'Comercial', NotaFiscal: 'Fiscal', Entrega: 'Expedição',
    Fornecedor: 'Compras', SolicitacaoCompra: 'Compras', OrdemCompra: 'Compras', Produto: 'Estoque', MovimentacaoEstoque: 'Estoque',
    ContaPagar: 'Financeiro', ContaReceber: 'Financeiro', CaixaMovimento: 'Financeiro', ConciliacaoBancaria: 'Financeiro',
    CentroCusto: 'Financeiro', PlanoDeContas: 'Financeiro', PlanoContas: 'Financeiro', User: 'Sistema'
  };
  const sanitizeOnWrite = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = (v) => typeof v === 'string'
      ? v.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,'').replace(/javascript:\s*/gi,'')
      : v;
    const out = Array.isArray(obj) ? obj.map((x) => sanitizeOnWrite(x)) : Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, (v && typeof v === 'object') ? sanitizeOnWrite(v) : clean(v)]));
    return out;
  };

  const createInContext = async (entityName, dados, campo = 'empresa_id') => {
    const stamped = carimbarContexto(sanitizeOnWrite(dados), campo);
    if (!stamped.group_id && !stamped[campo]) {
      throw new Error('Contexto multiempresa obrigatório: defina grupo ou empresa');
    }
    const created = await base44.entities[entityName].create(stamped);
    try {
      await base44.entities.AuditLog.create({
        usuario: (await base44.auth.me())?.email || 'Usuário',
        acao: 'Criação', modulo: MODULE_BY_ENTITY[entityName] || 'Sistema', tipo_auditoria: 'entidade', entidade: entityName,
        descricao: `Criado registro em ${entityName}`,
        empresa_id: stamped[campo] || null, group_id: stamped.group_id || null,
        dados_anteriores: null, dados_novos: created,
        data_hora: new Date().toISOString()
      });
    } catch {}
    return created;
  };
  const bulkCreateInContext = async (entityName, lista, campo = 'empresa_id') => {
    const stampedList = lista.map(item => {
      const s = carimbarContexto(sanitizeOnWrite(item), campo);
      if (!s.group_id && !s[campo]) {
        throw new Error('Contexto multiempresa obrigatório em item da lista');
      }
      return s;
    });
    const res = await base44.entities[entityName].bulkCreate(stampedList);
    try {
      await base44.entities.AuditLog.create({
        usuario: (await base44.auth.me())?.email || 'Usuário',
        acao: 'Criação', modulo: MODULE_BY_ENTITY[entityName] || 'Sistema', tipo_auditoria: 'entidade', entidade: entityName,
        descricao: `Criação em lote (${res?.length || stampedList.length})`,
        empresa_id: stampedList[0]?.[campo] || null, group_id: stampedList[0]?.group_id || null,
        dados_anteriores: null, dados_novos: { count: res?.length || stampedList.length },
        data_hora: new Date().toISOString()
      });
    } catch {}
    return res;
  };
  const updateInContext = async (entityName, id, dados, campo = 'empresa_id') => {
    const stamped = carimbarContexto(sanitizeOnWrite(dados), campo);
    if (!stamped.group_id && !stamped[campo]) {
      throw new Error('Contexto multiempresa obrigatório: defina grupo ou empresa');
    }
    const before = await base44.entities[entityName].get(id).catch(() => null);
    const updated = await base44.entities[entityName].update(id, stamped);
    try {
      await base44.entities.AuditLog.create({
        usuario: (await base44.auth.me())?.email || 'Usuário',
        acao: 'Edição', modulo: MODULE_BY_ENTITY[entityName] || 'Sistema', tipo_auditoria: 'entidade', entidade: entityName,
        descricao: `Atualizado registro ${id} em ${entityName}`,
        empresa_id: stamped[campo] || before?.[campo] || null, group_id: stamped.group_id || before?.group_id || null,
        dados_anteriores: before, dados_novos: updated,
        data_hora: new Date().toISOString()
      });
    } catch {}
    return updated;
  };
  const deleteInContext = async (entityName, id) => {
    const before = await base44.entities[entityName].get(id).catch(() => null);
    const res = await base44.entities[entityName].delete(id);
    try {
      await base44.entities.AuditLog.create({
        usuario: (await base44.auth.me())?.email || 'Usuário',
        acao: 'Exclusão', modulo: MODULE_BY_ENTITY[entityName] || 'Sistema', tipo_auditoria: 'entidade', entidade: entityName,
        descricao: `Excluído registro ${id} em ${entityName}`,
        empresa_id: before?.empresa_id || null, group_id: before?.group_id || null,
        dados_anteriores: before, dados_novos: null,
        data_hora: new Date().toISOString()
      });
    } catch {}
    return res;
  };
  const DEFAULT_SORTS = {
            Produto: { field: 'descricao', direction: 'asc' },
            Cliente: { field: 'nome', direction: 'asc' },
            Fornecedor: { field: 'nome', direction: 'asc' },
            Pedido: { field: 'data_pedido', direction: 'desc' },
            ContaPagar: { field: 'data_vencimento', direction: 'asc' },
            ContaReceber: { field: 'data_vencimento', direction: 'asc' },
            OrdemCompra: { field: 'data_solicitacao', direction: 'desc' },
            CentroCusto: { field: 'codigo', direction: 'asc' },
            PlanoDeContas: { field: 'codigo', direction: 'asc' },
            PlanoContas: { field: 'codigo', direction: 'asc' },
            User: { field: 'full_name', direction: 'asc' }
          };

          const normalizeSortField = (entityName, field) => {
            if (!field) return field;
            const f = String(field).toLowerCase();
            if (entityName === 'Produto') {
              if (f === 'cod' || f === 'código' || f === 'codigo') return 'codigo';
              if (f === 'tipo' || f === 'tipoitem' || f === 'tipo_item') return 'tipo_item';
              if (f === 'descrição' || f === 'descricao') return 'descricao';
            }
            return field;
          };
          const getLastSort = (entityName) => {
            try {
              const v = JSON.parse(localStorage.getItem(`sort_${entityName}`) || 'null');
              if (v?.sortField) v.sortField = normalizeSortField(entityName, v.sortField);
              return v;
            } catch { return null; }
          };
          const setLastSort = (entityName, sort) => {
            try {
              const s = { ...sort, sortField: normalizeSortField(entityName, sort?.sortField) };
              localStorage.setItem(`sort_${entityName}`, JSON.stringify(s));
            } catch {}
          };

          const filterInContext = async (entityName, criterios = {}, order = undefined, limit = undefined, campo = 'empresa_id') => {
                   const ENTITY_CONTEXT_FIELD = { Fornecedor: 'empresa_dona_id', Transportadora: 'empresa_dona_id', Colaborador: 'empresa_alocada_id' };
                   const SHARED_SET = new Set(['Cliente','Fornecedor','Transportadora']);
                   const ctxCampo = ENTITY_CONTEXT_FIELD[entityName] || campo || 'empresa_id';

                   const scope = getFiltroContexto(ctxCampo, true) || {};
                   const groupId = scope.group_id;
                   const empresaId = scope[ctxCampo];

                   // Detecta suporte a contexto via schema
                   let hasGroupField = true;
                   let hasCtxField = true;
                   try {
                     const sch = (base44.entities?.[entityName]?.schema ? await base44.entities[entityName].schema() : null);
                     const props = sch?.properties || {};
                     hasGroupField = Object.prototype.hasOwnProperty.call(props, 'group_id');
                     hasCtxField = Object.prototype.hasOwnProperty.call(props, ctxCampo);
                   } catch {}
                   const noContext = !hasGroupField && !hasCtxField;

                   if (!groupId && !empresaId && !noContext) return [];

                   const rest = { ...criterios };
                   const orConds = [];

                   if (empresaId) {
                     if (entityName === 'Cliente') {
                       orConds.push(
                         { empresa_id: empresaId },
                         { empresa_dona_id: empresaId },
                         { empresas_compartilhadas_ids: { $in: [empresaId] } }
                       );
                     } else {
                       orConds.push({ [ctxCampo]: empresaId });
                       if (SHARED_SET.has(entityName)) {
                         orConds.push({ empresas_compartilhadas_ids: { $in: [empresaId] } });
                       }
                     }
                   }
                   if (groupId) {
                     orConds.push({ group_id: groupId });
                     if (entityName === 'PerfilAcesso') {
                       orConds.push(
                         { grupo_id: groupId },
                         { group_id: null },
                         { grupo_id: null },
                         { group_id: '' },
                         { grupo_id: '' },
                         { group_id: 'grupo_001' },
                         { grupo_id: 'grupo_001' }
                       );
                     }
                     // Contexto do grupo sem empresa explícita → incluir todas empresas do grupo
                     if (!empresaId && Array.isArray(empresasDoGrupo) && empresasDoGrupo.length) {
                       const empresasIds = empresasDoGrupo.map(e => e.id).filter(Boolean);
                       if (empresasIds.length) {
                         if (entityName === 'Cliente') {
                           orConds.push(
                             { empresa_id: { $in: empresasIds } },
                             { empresa_dona_id: { $in: empresasIds } },
                             { empresas_compartilhadas_ids: { $in: empresasIds } }
                           );
                         } else if (entityName === 'Fornecedor' || entityName === 'Transportadora') {
                           orConds.push(
                             { empresa_dona_id: { $in: empresasIds } },
                             { empresas_compartilhadas_ids: { $in: empresasIds } }
                           );
                         } else if (entityName === 'Colaborador') {
                           orConds.push({ empresa_alocada_id: { $in: empresasIds } });
                         } else {
                           orConds.push({ [ctxCampo]: { $in: empresasIds } });
                         }
                       }
                     }
                   }

                   const filtro = noContext ? { ...rest } : { ...rest, ...(orConds.length ? { $or: orConds } : {}) };

                   // Derivar sort
                   let sortField, sortDirection;
                   if (typeof order === 'string' && order.length) {
                     sortDirection = order.startsWith('-') ? 'desc' : 'asc';
                     sortField = normalizeSortField(entityName, order.replace(/^-/, ''));
                     setLastSort(entityName, { sortField, sortDirection });
                   } else {
                     const last = getLastSort(entityName);
                     sortField = normalizeSortField(entityName, last?.sortField || DEFAULT_SORTS[entityName]?.field || 'updated_date');
                     sortDirection = last?.sortDirection || DEFAULT_SORTS[entityName]?.direction || 'desc';
                   }

                   const res = await base44.functions.invoke('entityListSorted', {
                     entityName,
                     filter: filtro,
                     sortField,
                     sortDirection,
                     limit: limit || 100,
                   });
                   return Array.isArray(res?.data) ? res.data : [];
                 };

  return {
    contexto,
    contextoCanonico,
    contextoValido: validacaoContexto.valid,
    erroContexto: validacaoContexto.error,
    empresaAtual,
    empresasDoGrupo,
    estaNoGrupo: contexto === 'grupo',
    grupoAtual,
    isLoading: loadingUser || loadingEmpresas || loadingContextoGrupoEmpresa,
    filtrarPorContexto,
    getFiltroContexto,
    carimbarContexto,
    createInContext,
    bulkCreateInContext,
    filterInContext,
    adicionarColunasContexto,
    alternarContexto,
    selecionarEmpresa,
    adaptarMenuPorContexto,
    obterSugestoesNavegacao,
    filtroEmpresa,
    setFiltroEmpresa,
    updateInContext,
    deleteInContext
  };
}

export default useContextoVisual;
