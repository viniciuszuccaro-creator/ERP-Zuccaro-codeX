import React from "react";
import { base44, isHttpBackendMode } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

function SessionEscapeActions({ hint }) {
  const { logout, supportsPasswordLogin } = useAuth();
  const handleSair = () => {
    try {
      logout(true);
    } catch (error) {
      console.error('[GuardRails] logout falhou; limpando sessão HTTP.', error);
      if (isHttpBackendMode && typeof window !== 'undefined') {
        import('@/api/erpHttpSession').then(({ clearErpHttpSession }) => {
          clearErpHttpSession();
          window.location.assign('/');
        });
      }
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" onClick={handleSair} className="gap-2">
          <LogOut className="w-4 h-4" />
          {supportsPasswordLogin ? 'Sair e entrar com outra conta' : 'Sair'}
        </Button>
      </div>
    </div>
  );
}

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
            <SessionEscapeActions hint="Se a tela ficou travada, saia e entre de novo com a conta proprietária." />
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
              <SessionEscapeActions hint="Se o seletor estiver vazio, saia e entre novamente para recarregar Grupo/Empresas." />
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
              <SessionEscapeActions hint="Se nenhuma empresa aparecer (Grupo CPA, CPA ferro e aço, 3Z LTDA), saia e entre com a conta correta." />
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
            <SessionEscapeActions />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
