import React from "react";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuardRails({ children, currentPageName }) {
  const { user } = useUser();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, isLoading: loadingContexto } = useContextoVisual();
  const [auth, setAuth] = React.useState(false);
  const [booted, setBooted] = React.useState(false);
  const getStoredContextId = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const grupoAtivoId = grupoAtual?.id || user?.grupo_atual_id || user?.grupo_padrao_id || getStoredContextId('group_atual_id');
  const empresaAtivaId = empresaAtual?.id || user?.empresa_atual_id || user?.empresa_padrao_id || getStoredContextId('empresa_atual_id');

  React.useEffect(() => {
    let mounted = true;
    base44.auth.isAuthenticated().then((ok) => {
      if (!mounted) return;
      setAuth(!!ok);
      setBooted(true);
    });
    return () => { mounted = false; };
  }, []);

  // Loading state until auth/context determined
  if (!booted || loadingContexto) {
    return (
      <div className="p-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Preparando ambiente…</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-64 bg-slate-100 rounded overflow-hidden">
              <div className="h-2 bg-blue-600 animate-pulse" style={{ width: "60%" }} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!auth || !user) {
    return (
      <div className="p-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Acesso necessário</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">Você precisa estar autenticado para acessar este conteúdo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validação de contexto (grupo x empresa)
  if (contexto === 'grupo') {
    if (!grupoAtivoId) {
      return (
        <div className="p-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Selecione um grupo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Defina o grupo ativo para continuar. Use os controles de contexto.</p>
            </CardContent>
          </Card>
        </div>
      );
    }
  } else {
    if (!empresaAtivaId) {
      return (
        <div className="p-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Selecione uma empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Defina a empresa ativa para continuar. Use o seletor no topo.</p>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // Permissão por módulo (Layout já valida, aqui reforçamos)
  const pageToModule = {
    CRM: 'CRM', Comercial: 'Comercial', Estoque: 'Estoque', Compras: 'Compras', Financeiro: 'Financeiro', Fiscal: 'Fiscal', RH: 'RH', Expedicao: 'Expedição'
  };
  const mod = pageToModule[currentPageName];
  if (mod && !hasPermission(mod, null, 'ver')) {
    try {
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        empresa_id: empresaAtual?.id || null,
        empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
        acao: 'Bloqueio',
        modulo: mod,
        entidade: 'Página',
        descricao: `GuardRails bloqueou acesso a ${currentPageName}`,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[GuardRails] Falha ao auditar bloqueio de contexto', error);
    }
    return (
      <div className="p-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">Você não possui permissão para acessar este módulo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
