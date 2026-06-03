import React, { Suspense, lazy } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ModuleContent from "@/components/layout/ModuleContent";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ProtectedSection from "@/components/security/ProtectedSection";
import AdminHeader from "@/components/administracao-sistema/AdminHeader";
import AdminTabs from "@/components/administracao-sistema/AdminTabs";

const PortalCliente = lazy(() => import("./PortalCliente"));

// Mapa completo de alias de URL → aba interna
const TAB_MAP = {
  // Parâmetros Gerais
  gerais: 'gerais', parametros: 'gerais', 'parametros-gerais': 'gerais', geral: 'gerais',
  configuracoes: 'gerais', fiscal: 'gerais', notificacoes: 'gerais',
  // Integrações
  integracoes: 'integracoes', connectors: 'integracoes', apps: 'integracoes',
  'apps-externos': 'integracoes', integracao: 'integracoes', integração: 'integracoes',
  nfe: 'integracoes', boletos: 'integracoes', whatsapp: 'integracoes', maps: 'integracoes',
  marketplaces: 'integracoes',
  // Acessos
  acessos: 'acessos', usuarios: 'acessos', 'controle-acesso': 'acessos', acesso: 'acessos',
  perfis: 'acessos', rbac: 'acessos', permissoes: 'acessos',
  // Segurança
  seguranca: 'seguranca', governanca: 'seguranca', segurança: 'seguranca',
  politicas: 'seguranca', jwt: 'seguranca', mfa: 'seguranca', sessoes: 'seguranca',
  // IA
  ia: 'ia', tecnologia: 'ia', 'tecnologia-ia-parametros': 'ia',
  apis: 'ia', webhooks: 'ia', 'chatbot-intents': 'ia', otimizacao: 'ia', modelos: 'ia',
  // Auditoria
  auditoria: 'auditoria', logs: 'auditoria', trilha: 'auditoria', global: 'auditoria',
  // Ferramentas
  ferramenta: 'ferramentas', ferramentas: 'ferramentas', tool: 'ferramentas', tools: 'ferramentas',
  seed: 'ferramentas', utilitarios: 'ferramentas', utilitários: 'ferramentas',
};

export default function AdministracaoSistema() {
  const { isAdmin } = usePermissions();
  const { user } = useUser();
  const { empresaAtual, grupoAtual } = useContextoVisual();

  const params = new URLSearchParams(window.location.search);
  const rawTab = (params.get("tab") || "gerais").toLowerCase().trim();
  const initialTab = TAB_MAP[rawTab] || 'gerais';

  // Usuários não-admin são redirecionados ao Portal do Cliente
  if (!isAdmin()) {
    return (
      <div className="w-full h-full">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center text-slate-600 w-full h-full">
            Carregando Portal…
          </div>
        }>
          <PortalCliente />
        </Suspense>
      </div>
    );
  }

  return (
    <ProtectedSection module="Sistema" action="visualizar">
      <ModuleLayout title="Administração do Sistema">
        <AdminHeader />
        <ModuleContent>
          <div className="p-4 md:p-6 w-full h-full">
            <AdminTabs
              initialTab={initialTab}
              isAdmin={isAdmin}
              empresaAtual={empresaAtual}
              grupoAtual={grupoAtual}
            />
          </div>
        </ModuleContent>
      </ModuleLayout>
    </ProtectedSection>
  );
}
