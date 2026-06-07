import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import IAPanel from "@/components/administracao-sistema/configuracoes-gerais/IAPanel";
import ContextoConfigBanner from "@/components/administracao-sistema/common/ContextoConfigBanner";
import HerancaConfigNotice from "@/components/administracao-sistema/common/HerancaConfigNotice";
import { Brain, Zap, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadScopedConfiguracaoSistema, useToggleConfig } from "@/components/lib/useToggleConfig";
import ToggleRow from "@/components/sistema/ToggleRow";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

const IA_CONFIGS_PADRAO = [
  { modulo: "Comercial", funcionalidade: "Previsao de Vendas", modelo_base: "local-preditivo", limite_tokens: 1200 },
  { modulo: "Financeiro", funcionalidade: "Conciliacao Bancaria", modelo_base: "local-financeiro", limite_tokens: 1600 },
  { modulo: "Producao", funcionalidade: "Otimizacao de OP", modelo_base: "local-producao", limite_tokens: 1400 },
  { modulo: "Engenharia", funcionalidade: "Leitura de Projetos", modelo_base: "local-documentos", limite_tokens: 2000 },
  { modulo: "Estoque", funcionalidade: "Reposicao Inteligente", modelo_base: "local-estoque", limite_tokens: 1200 },
  { modulo: "Seguranca", funcionalidade: "Deteccao de Anomalias", modelo_base: "local-seguranca", limite_tokens: 1200 },
];

export default function IAOtimizacaoIndex({ initialTab }) {
  const { empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const [tab, setTab] = React.useState(initialTab || 'ia');

  const eId = empresaAtual?.id;
  const gId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();

  const iaQueryKey = ['config-ia-toggles', eId ?? 'sem', gId ?? 'sem'];
  const contextoValido = !!(eId || gId);
  const podeEditarIA = isAdmin() || hasPermission("Sistema", "IA", "editar") || hasPermission("Sistema", "IA e Otimiza��o", "editar") || hasPermission("Sistema", "IA e Otimizacao", "editar");
  const podeCriarIA = isAdmin() || hasPermission("Sistema", "IA", "criar") || hasPermission("Sistema", "IA e Otimiza��o", "criar") || hasPermission("Sistema", "IA e Otimizacao", "criar");

  const { data: configsToggle = [], isFetching: isFetchingToggle } = useQuery({
    queryKey: iaQueryKey,
    queryFn: async () => {
      return loadScopedConfiguracaoSistema({ empresaId: eId, grupoId: gId, limit: 200 });
    },
    enabled: contextoValido,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const { saving, handleToggle, getToggleValue } = useToggleConfig(eId, gId, iaQueryKey);
  const queryClient = useQueryClient();

  // Subscription em tempo real: refetch quando ConfiguracaoSistema muda em outro contexto
  React.useEffect(() => {
    const unsub = base44.entities.ConfiguracaoSistema.subscribe((evt) => {
      if (evt.type === 'create' || evt.type === 'update') {
        const d = evt.data || {};
        const relevante = (eId && d.empresa_id === eId) || (gId && d.group_id === gId);
        if (relevante) queryClient.invalidateQueries({ queryKey: iaQueryKey, exact: true });
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [eId, gId]);

  // IAToggleRow agora usa o ToggleRow compartilhado com accentColor purple
  const IAToggleRow = ({ chave, label, desc }) => (
    <ToggleRow
      configs={configsToggle}
      chave={chave}
      categoria="Sistema"
      label={label}
      desc={desc}
      saving={saving}
      isFetching={isFetchingToggle}
      onToggle={handleToggle}
      getToggleValue={getToggleValue}
      accentColor="purple"
      disabled={!contextoValido || !podeEditarIA}
    />
  );

  const handleTabChange = (next) => {
    setTab(next);
    if (!contextoValido) return;
    try {
      void createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        empresa_id: empresaAtual?.id || null,
        group_id: gId || null,
        acao: 'Visualização',
        modulo: 'Sistema',
        tipo_auditoria: 'ui',
        entidade: 'IA e Otimização',
        descricao: `Aba visualizada: ${next}`,
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
    } catch {}
  };

  React.useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const { data: configsIA = [] } = useQuery({
    queryKey: ['configs-ia', eId ?? 'sem', gId ?? 'sem'],
    queryFn: () => filterInContext('IAConfig', {}, '-created_date', 999),
    enabled: contextoValido,
  });

  const criarConfigsPadraoMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) {
        throw new Error("Selecione um grupo ou empresa antes de criar configuracoes de IA.");
      }

      const existentes = await filterInContext('IAConfig', {}, '-created_date', 999);
      const existentesKeys = new Set((existentes || []).map((cfg) => `${cfg.modulo}::${cfg.funcionalidade}`));
      const criadas = [];

      for (const cfg of IA_CONFIGS_PADRAO) {
        const key = `${cfg.modulo}::${cfg.funcionalidade}`;
        if (existentesKeys.has(key)) continue;
        const created = await createInContext('IAConfig', {
          ...cfg,
          ativo: true,
          empresa_id: eId || null,
          group_id: gId || null,
          origem_configuracao: eId ? "empresa" : "grupo",
          criado_por: user?.email || user?.full_name || "Sistema",
        });
        criadas.push(created);
      }

      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        empresa_id: eId || null,
        group_id: gId || null,
        acao: "Criacao",
        modulo: "Sistema",
        entidade: "IAConfig",
        descricao: "Criacao de configuracoes padrao de IA no escopo selecionado",
        dados_novos: { quantidade: criadas.length, configuracoes: criadas.map((c) => ({ id: c.id, modulo: c.modulo, funcionalidade: c.funcionalidade })) },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });

      return criadas;
    },
    onSuccess: async (criadas) => {
      await queryClient.invalidateQueries({ queryKey: ['configs-ia'] });
      await queryClient.invalidateQueries({ queryKey: ['configs-ia-geral'] });
      toast.success(criadas.length ? `${criadas.length} configuracao(oes) de IA criada(s).` : "Configuracoes de IA ja estavam cadastradas.");
    },
    onError: (error) => {
      toast.error(String(error?.message || error));
    },
  });

  return (
    <div className="w-full h-full flex flex-col">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full h-full">
        <TabsList className="flex flex-wrap gap-2 h-auto">
          <TabsTrigger value="ia" data-action="IAOtimizacao.tab.ia"><Brain className="w-4 h-4 mr-2" /> IA e Modelos</TabsTrigger>
          <TabsTrigger value="otimizacao" data-action="IAOtimizacao.tab.otimizacao"><Zap className="w-4 h-4 mr-2" /> Otimização</TabsTrigger>
        </TabsList>

        <TabsContent value="ia" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4 grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
              <div className="col-span-full space-y-2">
                <ContextoConfigBanner />
                <HerancaConfigNotice />
              </div>
              <div className="col-span-full">
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-800">
                  💡 <strong>APIs Externas, Webhooks e Chatbot Intents</strong> estão centralizados em <strong>Cadastros Gerais → Tecnologia, IA & Parâmetros</strong>.
                </div>
              </div>

              <div className="col-span-full 2xl:col-span-1 space-y-3">
                <IAPanel />
                {/* Toggles de IA por módulo — centralizados aqui (removidos do ConfigGlobal) */}
                <Card>
                  <CardHeader className="bg-purple-50 border-b pb-3 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      Ativar/Desativar IA por Módulo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {(eId || gId) ? (
                      <>
                        <IAToggleRow chave="ia_leitura_projetos" label="IA Leitura de Projetos" desc="Análise automática de projetos de engenharia" />
                        <IAToggleRow chave="ia_preditiva_vendas" label="IA Preditiva de Vendas" desc="Previsão de demanda e detecção de churn" />
                        <IAToggleRow chave="ia_conciliacao" label="IA Conciliação Bancária" desc="Conciliação automática de extratos" />
                        <IAToggleRow chave="ia_producao" label="IA Produção" desc="Otimização de ordens de produção" />
                        <IAToggleRow chave="ia_recomendacao_produtos" label="IA Recomendação de Produtos" desc="Sugestões inteligentes no checkout" />
                        <IAToggleRow chave="ia_anomalia_financeira" label="IA Detector de Anomalias Financeiras" desc="Detecta pagamentos suspeitos e duplicados" />
                      </>
                    ) : (
                      <p className="text-xs text-amber-700 p-2 bg-amber-50 rounded border border-amber-200">
                        ⚠️ Selecione empresa ou grupo para configurar os toggles de IA.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="col-span-full 2xl:col-span-1">
                <CardHeader className="bg-purple-50 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2"><Brain className="w-5 h-5 text-purple-600" /> Configurações por Módulo</CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!contextoValido || !podeCriarIA || criarConfigsPadraoMutation.isPending}
                      onClick={() => criarConfigsPadraoMutation.mutate()}
                      data-action="IAOtimizacao.configsPadrao.criar"
                      data-permission="Sistema.IA e Otimizacao.criar"
                      data-sensitive="true"
                      data-context-required="group-or-company"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${criarConfigsPadraoMutation.isPending ? "animate-spin" : ""}`} />
                      {criarConfigsPadraoMutation.isPending ? "Criando..." : "Criar Padroes"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 max-h-80 overflow-y-auto">
                  {configsIA.length > 0 ? (
                    <div className="space-y-2">
                      {configsIA.map((cfg) => (
                        <div key={cfg.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-semibold text-sm">{cfg.modulo} • {cfg.funcionalidade}</p>
                            <p className="text-xs text-slate-500">Modelo: {cfg.modelo_base} • Limite: {cfg.limite_tokens} tokens</p>
                          </div>
                          <Badge className={cfg.ativo ? 'bg-green-600' : 'bg-slate-600'}>
                            {cfg.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-500">
                      <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>Nenhuma configuração de IA cadastrada ainda.</p>
                      <p className="text-xs mt-1">Use "Criar Padroes" para iniciar a configuracao local deste escopo.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="otimizacao" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center py-10 text-slate-500 border rounded-lg">
                  <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Nenhuma otimização ativa no momento</p>
                  <p className="text-sm mt-1">Ative PriceBrain e ChurnDetection nos módulos e defina modelos na aba “IA e Modelos”.</p>
                </div>
                <div className="p-4 border rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-700 font-medium">Como começar</p>
                  <ul className="mt-2 list-disc list-inside text-sm text-slate-600 space-y-1">
                    <li>Acesse IA e Modelos e selecione o modelo base</li>
                    <li>Habilite otimizações por módulo conforme a necessidade</li>
                    <li>Monitore resultados na Auditoria e Logs</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

