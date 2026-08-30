import { useState, useEffect } from "react";
import { base44, isApiKeyMode, isLocalOnlyMode, localApiUser } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useContextoGrupoEmpresa() {
  const isRemoteApiKeyMode = isApiKeyMode && !isLocalOnlyMode;
  const [user, setUser] = useState(null);
  const [contexto, setContexto] = useState(() => {
    try {
      return localStorage.getItem('contexto_atual') || 'empresa';
    } catch {
      return 'empresa';
    }
  });
  const [isLoadingContexto, setIsLoadingContexto] = useState(true);
  const [grupoAtual, setGrupoAtual] = useState(null);
  const [empresaAtual, setEmpresaAtual] = useState(null);
  const queryClient = useQueryClient();

  const carregarGrupoPorIdOuPadrao = async (currentUser) => {
    const grupoId = currentUser?.grupo_atual_id || currentUser?.grupo_padrao_id || localStorage.getItem('group_atual_id');
    if (grupoId) {
      const grupos = await base44.entities.GrupoEmpresarial.filter({ id: grupoId });
      if (grupos[0]) {
        setGrupoAtual(grupos[0]);
        try { localStorage.setItem('group_atual_id', grupos[0].id); } catch { /* Estado em memoria permanece valido. */ }
        return grupos[0];
      }
    }

    if (isRemoteApiKeyMode || currentUser?.role === 'admin') {
      const todos = await base44.entities.GrupoEmpresarial.list();
      const ativo = todos.find(g => g.status === 'Ativo') || todos[0];
      if (ativo) {
        setGrupoAtual(ativo);
        try { localStorage.setItem('group_atual_id', ativo.id); } catch { /* Estado em memoria permanece valido. */ }
        return ativo;
      }
    }

    return null;
  };

  useEffect(() => {
    carregarContextoInicial();
  }, []);

  const carregarContextoInicial = async () => {
    setIsLoadingContexto(true);
    try {
      const currentUser = isRemoteApiKeyMode ? localApiUser : await base44.auth.me();
      setUser(currentUser);

      // Detecta contexto: prioridade user.contexto_atual, senão localStorage
      const ctxPersistido = (() => {
        try { return localStorage.getItem('contexto_atual'); } catch { return null; }
      })();
      const ctx = currentUser.contexto_atual || ctxPersistido || 'empresa';
      setContexto(ctx);
      try { localStorage.setItem('contexto_atual', ctx); } catch { /* Estado em memoria permanece valido. */ }

      if (ctx === 'grupo') {
        // Tenta user > localStorage
        await carregarGrupoPorIdOuPadrao(currentUser);
      } else {
        // Mesmo no contexto Empresa, manter o Grupo ativo para herança de configurações.
        await carregarGrupoPorIdOuPadrao(currentUser);

        const empresaId = currentUser.empresa_atual_id || currentUser.empresa_padrao_id || localStorage.getItem('empresa_atual_id');
        if (empresaId) {
          const empresas = await base44.entities.Empresa.filter({ id: empresaId });
          if (empresas[0]) {
            setEmpresaAtual(empresas[0]);
          } else if (isRemoteApiKeyMode || currentUser?.role === 'admin') {
            const todasEmpresas = await base44.entities.Empresa.list();
            const ativa = todasEmpresas.find(e => e.status === 'Ativa') || todasEmpresas[0];
            if (ativa) {
              setEmpresaAtual(ativa);
              try { localStorage.setItem('empresa_atual_id', ativa.id); } catch { /* Estado em memoria permanece valido. */ }
            }
          }
        } else if (isRemoteApiKeyMode || currentUser?.role === 'admin') {
          const empresas = await base44.entities.Empresa.list();
          const ativa = empresas.find(e => e.status === 'Ativa') || empresas[0];
          if (ativa) {
            setEmpresaAtual(ativa);
            try { localStorage.setItem('empresa_atual_id', ativa.id); } catch { /* Estado em memoria permanece valido. */ }
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar contexto:", error);
      if (isRemoteApiKeyMode) {
        setUser(localApiUser);
        setContexto('empresa');
      }
    } finally {
      setIsLoadingContexto(false);
    }
  };

  const trocarParaGrupo = useMutation({
    mutationFn: async (grupoId) => {
      if (isRemoteApiKeyMode) {
        const grupos = await base44.entities.GrupoEmpresarial.filter({ id: grupoId });
        return grupos[0] || null;
      }

      // V21.7 FIX: Verificar se usuário tem acesso ao grupo
      const temAcesso = user?.role === 'admin' || 
        user?.grupos_vinculados?.some(v => v.grupo_id === grupoId && v.ativo);

      if (!temAcesso) {
        throw new Error("Você não tem acesso a este grupo. Configure os vínculos em Cadastros > Acesso.");
      }

      await base44.auth.updateMe({
        contexto_atual: 'grupo',
        grupo_atual_id: grupoId
      });

      const grupos = await base44.entities.GrupoEmpresarial.filter({ id: grupoId });
      const grupo = grupos[0];
      
      await base44.entities.AuditLog.create({
        usuario: user.full_name,
        usuario_id: user.id,
        acao: 'Troca de Contexto',
        modulo: 'Sistema',
        descricao: `Mudou para contexto de GRUPO: ${grupo?.nome_do_grupo || grupoId}`,
        grupo_id: grupoId,
        data_hora: new Date().toISOString()
      });

      return grupo;
    },
    onSuccess: (grupo) => {
      setContexto('grupo');
      setGrupoAtual(grupo);
      setEmpresaAtual(null);
      setUser((prev) => prev ? { ...prev, contexto_atual: 'grupo', grupo_atual_id: grupo?.id || prev.grupo_atual_id } : prev);
      try { localStorage.setItem('contexto_atual', 'grupo'); } catch { /* Estado em memoria permanece valido. */ }
      try { if (grupo?.id) localStorage.setItem('group_atual_id', grupo.id); } catch { /* Estado em memoria permanece valido. */ }
      queryClient.invalidateQueries();
      // Evitar reload completo; atualizar queries e deixar GuardRails liberar
    },
    onError: (error) => {
      // V21.7: Mostrar erro amigável
      console.error("Erro ao trocar grupo:", error);
      alert(error.message);
    }
  });

  const trocarParaEmpresa = useMutation({
    mutationFn: async (empresaId) => {
      if (isRemoteApiKeyMode) {
        const empresas = await base44.entities.Empresa.filter({ id: empresaId });
        return empresas[0] || null;
      }

      // V21.7 FIX: Verificar se usuário tem acesso à empresa
      const temAcesso = user?.role === 'admin' || 
        user?.empresas_vinculadas?.some(v => v.empresa_id === empresaId && v.ativo);

      if (!temAcesso) {
        throw new Error("Você não tem acesso a esta empresa. Configure os vínculos em Cadastros > Acesso.");
      }

      await base44.auth.updateMe({
        contexto_atual: 'empresa',
        empresa_atual_id: empresaId
      });

      const empresas = await base44.entities.Empresa.filter({ id: empresaId });
      const empresa = empresas[0];
      
      await base44.entities.AuditLog.create({
        usuario: user.full_name,
        usuario_id: user.id,
        acao: 'Troca de Contexto',
        modulo: 'Sistema',
        descricao: `Mudou para contexto de EMPRESA: ${empresa?.nome_fantasia || empresa?.razao_social || empresaId}`,
        empresa_id: empresaId,
        data_hora: new Date().toISOString()
      });

      return empresa;
    },
    onSuccess: (empresa) => {
      setContexto('empresa');
      setEmpresaAtual(empresa);
      setUser((prev) => prev ? { ...prev, contexto_atual: 'empresa', empresa_atual_id: empresa?.id || prev.empresa_atual_id } : prev);
      try { localStorage.setItem('contexto_atual', 'empresa'); } catch { /* Estado em memoria permanece valido. */ }
      try { if (empresa?.id) localStorage.setItem('empresa_atual_id', empresa.id); } catch { /* Estado em memoria permanece valido. */ }
      queryClient.invalidateQueries();
      // Sem reload completo
    },
    onError: (error) => {
      // V21.7: Mostrar erro amigável
      console.error("Erro ao trocar empresa:", error);
      alert(error.message);
    }
  });

  const { data: empresasDoGrupo = [] } = useQuery({
    queryKey: ['empresas-grupo', grupoAtual?.id],
    queryFn: async () => {
      if (!grupoAtual?.id) return [];
      return await base44.entities.Empresa.filter({
        grupo_id: grupoAtual.id,
        status: 'Ativa'
      });
    },
    enabled: !!grupoAtual && contexto === 'grupo',
  });

  const obterPoliticaPadrao = async (tipoDocumento) => {
    if (!grupoAtual) return null;

    const politicas = await base44.entities.PoliticaDistribuicao.filter({
      grupo_id: grupoAtual.id,
      tipo_documento: tipoDocumento,
      ativa: true,
      padrao_para_tipo: true
    });

    return politicas[0] || null;
  };

  const calcularDistribuicao = (valorTotal, politica, empresas = null) => {
    if (!politica) return [];

    const empresasParaRatear = empresas || empresasDoGrupo;
    const distribuicao = [];

    if (politica.criterio === 'percentual') {
      empresasParaRatear.forEach(empresa => {
        const participante = politica.empresas_participantes?.find(
          p => p.empresa_id === empresa.id
        );
        if (participante && participante.ativo) {
          const valor = (valorTotal * participante.percentual) / 100;
          distribuicao.push({
            empresa_id: empresa.id,
            empresa_nome: empresa.nome_fantasia || empresa.razao_social,
            valor: valor,
            percentual: participante.percentual
          });
        }
      });
    } else if (politica.criterio === 'fixo_por_empresa') {
      empresasParaRatear.forEach(empresa => {
        const participante = politica.empresas_participantes?.find(
          p => p.empresa_id === empresa.id
        );
        if (participante && participante.ativo) {
          distribuicao.push({
            empresa_id: empresa.id,
            empresa_nome: empresa.nome_fantasia || empresa.razao_social,
            valor: participante.valor_fixo,
            percentual: (participante.valor_fixo / valorTotal) * 100
          });
        }
      });
    }

    return distribuicao;
  };

  const ratearDocumento = async (entidade, documentoId, distribuicao) => {
    const titulosGerados = [];

    for (const dist of distribuicao) {
      const docs = await base44.entities[entidade].filter({ id: documentoId });
      const docOriginal = docs[0];

      const novaTitulo = {
        ...docOriginal,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        group_id: null,
        empresa_id: dist.empresa_id,
        origem: 'empresa',
        documento_grupo_id: documentoId,
        valor: dist.valor,
        valor_original_grupo: docOriginal.valor,
        percentual_rateio: dist.percentual,
        rateado_para_empresas: false,
        sincronizar_baixa_com_grupo: true
      };

      const created = await base44.entities[entidade].create(novaTitulo);
      titulosGerados.push({
        ...dist,
        titulo_id: created.id,
        status: created.status
      });
    }

    await base44.entities[entidade].update(documentoId, {
      rateado_para_empresas: true,
      distribuicao_realizada: titulosGerados
    });

    return titulosGerados;
  };

  const sincronizarBaixaParaEmpresas = async (entidade, documentoGrupoId, valorPago) => {
    const docs = await base44.entities[entidade].filter({ id: documentoGrupoId });
    const docGrupo = docs[0];
    
    if (!docGrupo || !docGrupo.distribuicao_realizada || docGrupo.distribuicao_realizada.length === 0) {
      return;
    }

    const percentualPago = valorPago / docGrupo.valor;

    for (const dist of docGrupo.distribuicao_realizada) {
      const valorPagoEmpresa = dist.valor * percentualPago;
      
      await base44.entities[entidade].update(dist.titulo_id, {
        valor_pago: valorPagoEmpresa,
        status: percentualPago >= 1 ? 'Pago' : docGrupo.status,
        data_pagamento: percentualPago >= 1 ? new Date().toISOString().split('T')[0] : null
      });
    }
  };

  const sincronizarBaixaParaGrupo = async (entidade, documentoEmpresaId) => {
    const docsEmpresa = await base44.entities[entidade].filter({ id: documentoEmpresaId });
    const docEmpresa = docsEmpresa[0];
    
    if (!docEmpresa || !docEmpresa.documento_grupo_id) {
      return;
    }

    const docsGrupo = await base44.entities[entidade].filter({ id: docEmpresa.documento_grupo_id });
    const docGrupo = docsGrupo[0];
    
    let totalPago = 0;
    let todosPagos = true;

    for (const dist of docGrupo.distribuicao_realizada) {
      const docsItem = await base44.entities[entidade].filter({ id: dist.titulo_id });
      const doc = docsItem[0];
      totalPago += doc.valor_pago || 0;
      if (doc.status !== 'Pago' && doc.status !== 'Recebido') {
        todosPagos = false;
      }
    }

    await base44.entities[entidade].update(docGrupo.id, {
      valor_pago: totalPago,
      status: todosPagos ? 'Pago' : 'Pendente'
    });
  };

  return {
    user,
    contexto,
    grupoAtual,
    empresaAtual,
    empresasDoGrupo,
    estaNoGrupo: contexto === 'grupo',
    estaEmEmpresa: contexto === 'empresa',
    podeOperarEmGrupo: user?.pode_operar_em_grupo || false,
    podeVerTodasEmpresas: user?.pode_ver_todas_empresas || false,
    trocarParaGrupo,
    trocarParaEmpresa,
    obterPoliticaPadrao,
    calcularDistribuicao,
    ratearDocumento,
    sincronizarBaixaParaEmpresas,
    sincronizarBaixaParaGrupo,
    isLoading: isLoadingContexto || !user
  };
}

export default useContextoGrupoEmpresa;
