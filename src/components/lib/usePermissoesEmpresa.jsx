import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook para verificar permissões contextuais baseadas em empresa, módulo e ação
 * Substitui o usePermissions com suporte multi-empresa
 */
export function usePermissoesEmpresa() {
  const [user, setUser] = useState(null);
  const [empresaAtual, setEmpresaAtual] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setEmpresaAtual(u?.empresa_atual_id || u?.empresa_padrao_id);
    }).catch(() => {});
  }, []);

  // Buscar permissões específicas do usuário para a empresa atual
  const { data: permissoes = [] } = useQuery({
    queryKey: ['permissoes-empresa', user?.id, empresaAtual],
    queryFn: () => base44.entities.PermissaoEmpresaModulo.filter({
      usuario_id: user.id,
      empresa_id: empresaAtual,
      ativo: true
    }),
    enabled: !!user && !!empresaAtual,
  });

  /**
   * Verifica se o usuário tem permissão para uma ação específica
   * @param {string} modulo - Nome do módulo (ex: "Comercial e Vendas")
   * @param {string} acao - Tipo de ação (visualizar, criar, editar, excluir, aprovar)
   * @param {string} submodulo - (opcional) Submódulo específico
   * @param {string} aba - (opcional) Aba específica
   * @returns {boolean}
   */
  const temPermissao = (modulo, acao, submodulo = null, aba = null) => {
    // Fail-closed: role admin / acesso_consolidado nao bypassam matriz
    if (!user) return false;

    if (!permissoes || permissoes.length === 0) {
      return false;
    }

    // Buscar permissão específica
    let permissaoEncontrada = permissoes.find(p => {
      let match = p.modulo === modulo;
      
      if (submodulo) {
        match = match && p.submodulo === submodulo;
      }
      
      if (aba) {
        match = match && p.aba === aba;
      }
      
      return match;
    });

    if (!permissaoEncontrada) {
      return false;
    }

    // Mapear níveis de acesso
    const hierarquiaAcesso = {
      'Nenhum': [],
      'Visualizar': ['visualizar'],
      'Editar': ['visualizar', 'editar'],
      'Criar': ['visualizar', 'editar', 'criar'],
      'Excluir': ['visualizar', 'editar', 'criar', 'excluir'],
      'Aprovar': ['visualizar', 'editar', 'criar', 'excluir', 'aprovar']
    };

    const acoesPermitidas = hierarquiaAcesso[permissaoEncontrada.nivel_acesso] || [];
    
    return acoesPermitidas.includes(acao.toLowerCase());
  };

  /**
   * Verifica se pode visualizar um módulo
   */
  const podeVisualizar = (modulo, submodulo = null, aba = null) => {
    return temPermissao(modulo, 'visualizar', submodulo, aba);
  };

  /**
   * Verifica se pode editar
   */
  const podeEditar = (modulo, submodulo = null, aba = null) => {
    return temPermissao(modulo, 'editar', submodulo, aba);
  };

  /**
   * Verifica se pode criar
   */
  const podeCriar = (modulo, submodulo = null, aba = null) => {
    return temPermissao(modulo, 'criar', submodulo, aba);
  };

  /**
   * Verifica se pode excluir
   */
  const podeExcluir = (modulo, submodulo = null, aba = null) => {
    return temPermissao(modulo, 'excluir', submodulo, aba);
  };

  /**
   * Verifica se pode aprovar
   */
  const podeAprovar = (modulo, submodulo = null, aba = null) => {
    return temPermissao(modulo, 'aprovar', submodulo, aba);
  };

  /**
   * Obtém o nível de acesso para um módulo
   */
  const obterNivelAcesso = (modulo, submodulo = null, aba = null) => {
    const permissao = permissoes.find(p => {
      let match = p.modulo === modulo;
      if (submodulo) match = match && p.submodulo === submodulo;
      if (aba) match = match && p.aba === aba;
      return match;
    });

    return permissao?.nivel_acesso || 'Nenhum';
  };

  /**
   * Registrar log de auditoria automaticamente
   */
  const registrarLog = async (acao, modulo, entidade = null, registroId = null, detalhes = null) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email,
        usuario_id: user?.id,
        acao: acao,
        modulo: modulo,
        entidade: entidade,
        registro_id: registroId,
        descricao: detalhes?.descricao,
        dados_anteriores: detalhes?.dados_anteriores,
        dados_novos: detalhes?.dados_novos,
        empresa_id: empresaAtual,
        empresa_nome: user?.empresas_vinculadas?.find(e => e.empresa_id === empresaAtual)?.empresa_nome,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao registrar log de auditoria:', error);
    }
  };

  return {
    user,
    empresaAtual,
    permissoes,
    isAdmin: user?.role === 'admin',
    temAcessoConsolidado: user?.acesso_consolidado || false,
    temPermissao,
    podeVisualizar,
    podeEditar,
    podeCriar,
    podeExcluir,
    podeAprovar,
    obterNivelAcesso,
    registrarLog,
    isLoading: !user
  };
}

/**
 * Componente para proteger ações baseado em permissões multi-empresa
 */
export function AcaoProtegidaEmpresa({ 
  children, 
  modulo, 
  acao,
  submodulo = null,
  aba = null,
  fallback = null,
  showMessage = false
}) {
  const { temPermissao, isLoading } = usePermissoesEmpresa();

  if (isLoading) {
    return fallback || null;
  }

  const permitido = temPermissao(modulo, acao, submodulo, aba);

  if (!permitido) {
    if (showMessage) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            Você não tem permissão para {acao} em {modulo}
            {submodulo && ` > ${submodulo}`}
            {aba && ` > ${aba}`}
          </p>
        </div>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}

export default usePermissoesEmpresa;