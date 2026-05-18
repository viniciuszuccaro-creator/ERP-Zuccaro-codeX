import { useUser } from "./UserContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function usePermissions() {
  const { user, isLoading: loadingUser } = useUser();

  // Buscar perfil de acesso completo
  const { data: perfilAcesso, isLoading: loadingPerfil } = useQuery({
    queryKey: ['perfil-acesso', user?.perfil_acesso_id],
    queryFn: async () => {
      if (!user?.perfil_acesso_id) return null;
      return await base44.entities.PerfilAcesso.get(user.perfil_acesso_id);
    },
    enabled: !!(user?.perfil_acesso_id && user.perfil_acesso_id !== ""),
    staleTime: 300000,  // 5 min — evita re-fetches que causam flicker no RBAC
    gcTime: 600000,
    retry: 1,
    });

    // Normalização e aliases (HÍBRIDO: melhor opção sem quebrar legado)
    const normalizeSimple = (s) => {
      if (!s) return '';
      return String(s)
        .normalize('NFD').replace(/\p{Diacritic}/gu, '') // remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9\.]/g, '');
    };

    const MODULE_ALIASES = {
      // principais variações de nomes de módulos
      'financeiro': 'Financeiro', 'financeiroecontabil': 'Financeiro',
      'compras': 'Compras', 'comprasesuprimentos': 'Compras',
      'comercial': 'Comercial', 'comercialevendas': 'Comercial',
      'estoque': 'Estoque', 'estoqueealmoxarifado': 'Estoque',
      'expedicao': 'Expedição', 'expedicaologistica': 'Expedição',
      'producao': 'Produção',
      'crm': 'CRM', 'crmrelacionamento': 'CRM',
      'fiscal': 'Fiscal',
      'rh': 'RH', 'recursoshumanos': 'RH',
      'dashboard': 'Dashboard', 'dashboardcorporativo': 'Dashboard',
      'relatorios': 'Relatórios', 'relatorioseanalises': 'Relatórios',
      'agenda': 'Agenda',
      'cadastros': 'Cadastros', 'cadastrosgerais': 'Cadastros',
      'contratos': 'Contratos',
      'administracao': 'Sistema', 'administracaosistema': 'Sistema', 'sistema': 'Sistema'
    };

    const SECTION_ALIASES = {
      controledeacesso: 'acessos',
      controleacesso: 'acessos',
      controledeacessos: 'acessos',
      gestaoacessos: 'acessos',
      gestaodeacessos: 'acessos',
      acessos: 'acessos',
      permissao: 'acessos',
      permissoes: 'acessos',
      perfilacesso: 'acessos',
      perfisacesso: 'acessos',
      perfis: 'acessos',
      usuarios: 'acessos',
      integracoes: 'integracoes',
      ia: 'ia',
      iaeotimizacao: 'ia',
      configuracoesgerais: 'configuracoes',
      configuracoes: 'configuracoes',
      pessoas: 'pessoas',
      pessoasparceiros: 'pessoas',
      cliente: 'pessoas',
      clientes: 'pessoas',
      fornecedor: 'pessoas',
      fornecedores: 'pessoas',
      transportadora: 'pessoas',
      transportadoras: 'pessoas',
      colaborador: 'pessoas',
      colaboradores: 'pessoas',
      representante: 'pessoas',
      representantes: 'pessoas',
    };

    const resolveModule = (mod) => {
      if (!mod) return mod;
      const norm = normalizeSimple(mod);
      return MODULE_ALIASES[norm] || mod;
    };

    const getNodeByPath = (root, pathArr) => {
      let cursor = root;
      for (let i = 0; i < pathArr.length; i++) {
        if (!cursor || typeof cursor !== 'object') return undefined;
        const rawKey = pathArr[i];
        const key = SECTION_ALIASES[normalizeSimple(rawKey)] || rawKey;
        const candidates = [rawKey, key, resolveModule(rawKey)].filter(Boolean);
        const keys = Object.keys(cursor || {});
        const found = keys.find((k) => candidates.some((candidate) => normalizeSimple(k) === normalizeSimple(candidate)));
        cursor = found ? cursor[found] : undefined;
      }
      return cursor;
    };

    const getRootNode = (root, module) => {
      if (!root || typeof root !== 'object') return undefined;
      const candidates = [module, resolveModule(module)].filter(Boolean);
      const keys = Object.keys(root || {});
      for (const candidate of candidates) {
        const found = keys.find((k) => normalizeSimple(k) === normalizeSimple(candidate));
        if (found) return root[found];
      }
      return undefined;
    };

    const nodeHasAction = (node, desired) => {
      if (Array.isArray(node)) return node.includes(desired) || (desired === 'visualizar' && node.includes('ver'));
      if (!node || typeof node !== 'object') return false;
      const stack = [node];
      while (stack.length) {
        const current = stack.pop();
        if (Array.isArray(current)) {
          if (current.includes(desired) || (desired === 'visualizar' && current.includes('ver'))) return true;
        } else if (current && typeof current === 'object') {
          Object.values(current).forEach((value) => stack.push(value));
        }
      }
      return false;
    };

  // Verificação de permissão com suporte a múltiplos níveis: módulo.submódulo.aba.campo
  const parsePermissionKey = (permissionKey, fallbackAction = "visualizar") => {
    const parts = String(permissionKey || "").split(".").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return { module: null, section: null, action: fallbackAction };
    if (parts.length === 1) return { module: parts[0], section: null, action: fallbackAction };
    if (parts.length === 2) return { module: parts[0], section: null, action: parts[1] || fallbackAction };
    return {
      module: parts[0],
      section: parts.slice(1, -1),
      action: parts[parts.length - 1] || fallbackAction,
    };
  };

  const hasPermission = (module, section, action = "visualizar") => {
    if (!user) return false;
    if (user.role === "admin") return true;
    const perms = perfilAcesso?.permissoes;
    if (!perms) return false;
    if (!section && typeof module === "string" && module.includes(".")) {
      const parsed = parsePermissionKey(module, action);
      module = parsed.module;
      section = parsed.section;
      action = parsed.action;
    }

    // normaliza alias (sinônimos → ação canônica)
    const normalize = (a) => {
      if (!a) return 'visualizar';
      const map = {
        // visualizar
        ver: 'visualizar', view: 'visualizar', read: 'visualizar', listar: 'visualizar', status: 'visualizar', consultar: 'visualizar',
        // excluir
        delete: 'excluir', remove: 'excluir', destroy: 'excluir', apagar: 'excluir',
        // cancelar
        cancel: 'cancelar', cancelar: 'cancelar',
        // criar
        create: 'criar', add: 'criar', emitir: 'criar', enviar: 'criar', importar: 'criar',
        // editar
        update: 'editar', edit: 'editar', carta: 'editar', corrigir: 'editar', gerenciar: 'editar', executar: 'editar',
        // aprovar
        approve: 'aprovar', aprovar: 'aprovar', approvar: 'aprovar',
        // exportar
        export: 'exportar', exportar: 'exportar', imprimir: 'exportar', print: 'exportar'
      };
      return map[a] || a;
    };
    const desired = normalize(action);

    const modNode = getRootNode(perms, module);
    if (!modNode) return false;

    // Se não houver seção especificada, verifica ação em qualquer subnível direto
    if (!section) {
      return nodeHasAction(modNode, desired);
    }

    // Suporta paths hierárquicos: "Pedidos.Financeiro.margens" ou ["Pedidos","Financeiro","margens"]
    const path = Array.isArray(section) ? section : String(section).split('.').filter(Boolean);
    let cursor = getNodeByPath(modNode, path);
    if (cursor == null) return false;
    return nodeHasAction(cursor, desired);
  };

  // Helpers específicos para granularidade
  const hasTabPermission = (module, submodule, tab, action = 'visualizar') => {
    const section = [submodule, tab].filter(Boolean);
    return hasPermission(module, section, action);
  };

  const hasFieldPermission = (module, submodule, tab, field, action = 'visualizar') => {
    const section = [submodule, tab, field].filter(Boolean);
    return hasPermission(module, section, action);
  };

  // Convenções sugeridas de chaves para Produtos/Precificação
  // Estoque -> Produto -> Precificacao -> (custo_aquisicao, margem_percentual)
  // Comercial -> Pedido -> Financeiro -> (emitir_nfe, aprovar_desconto)

  const hasGranularPermission = (module, section, action) => {
    return hasPermission(module, section, action);
  };

  const hasPermissionKey = (permissionKey, fallbackAction = "visualizar") => {
    const parsed = parsePermissionKey(permissionKey, fallbackAction);
    return hasPermission(parsed.module, parsed.section, parsed.action);
  };

  const isAdmin = () => {
    return user?.role === "admin";
  };

  // Expor resolvedor de módulo para uso externo (ex.: DataTableERP permission prop)
  const resolveModuleKey = resolveModule;

  const canApprove = (module, section = null) => {
    return hasPermission(module, section, 'aprovar');
  };

  const canDelete = (module, section = null) => {
    return hasPermission(module, section, 'excluir');
  };

  const canCancel = (module, section = null) => {
    return hasPermission(module, section, 'cancelar');
  };

  const canCreate = (module, section = null) => {
    return hasPermission(module, section, 'criar');
  };

  const canEdit = (module, section = null) => {
    return hasPermission(module, section, 'editar');
  };

  const canExport = (module, section = null) => {
    return hasPermission(module, section, 'exportar');
  };

  return {
    hasPermission,
    hasPermissionKey,
    parsePermissionKey,
    hasGranularPermission,
    hasTabPermission,
    hasFieldPermission,
    isAdmin,
    canApprove,
    canDelete,
    canCreate,
    canEdit,
    canExport,
    canCancel,
    resolveModuleKey,
    isLoading: loadingUser || loadingPerfil,
    user,
    perfilAcesso
  };
}
