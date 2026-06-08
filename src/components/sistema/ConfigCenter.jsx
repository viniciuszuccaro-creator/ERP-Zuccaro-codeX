import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Sparkles, Cloud, Key, CheckCircle } from 'lucide-react';
import { loadScopedConfiguracaoSistema, useToggleConfig } from '@/components/lib/useToggleConfig';
import ToggleRow from '@/components/sistema/ToggleRow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * ConfigCenter — usa ConfiguracaoSistema (via upsertConfig) para toggles,
 * evitando o erro 422 de empresa_id obrigatório no GovernancaEmpresa.
 */
export default function ConfigCenter({ empresaId: empresaIdProp }) {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const eId = empresaIdProp || empresaAtual?.id;
  const gId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const canLoad = Boolean(eId || gId);

  const queryKey = ['config-center-v2', eId ?? 'sem', gId ?? 'sem'];
  const { saving, handleToggle, getToggleValue } = useToggleConfig(eId, gId, queryKey);

  // Carrega configs diretamente por escopo para manter heranca grupo/empresa apos refresh.
  const { data: configs = [], refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      return loadScopedConfiguracaoSistema({ empresaId: eId, grupoId: gId, limit: 200 });
    },
    enabled: canLoad,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // IA configs para listagem
  const { data: configsIA = [] } = useQuery({
    queryKey: ['configs-ia-geral', eId ?? 'sem', gId ?? 'sem'],
    queryFn: () => filterInContext('IAConfig', {}, '-updated_date', 500),
    enabled: canLoad,
  });

  const getConfig = (chave) => {
    const list = (configs || []).filter(c => c.chave === chave);
    if (!list.length) return null;
    if (eId && gId) { const x = list.find(c => c.empresa_id === eId && c.group_id === gId); if (x) return x; }
    if (eId) { const x = list.find(c => c.empresa_id === eId); if (x) return x; }
    if (gId) { const x = list.find(c => c.group_id === gId); if (x) return x; }
    return list[0];
  };



  if (!canLoad) {
    return (
      <div className="w-full h-full p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg" data-context-required="true">
        ⚠️ Selecione uma empresa ou grupo para carregar as configurações.
      </div>
    );
  }

  const modulosIA = configsIA.reduce((acc, c) => {
    if (!acc[c.modulo]) acc[c.modulo] = [];
    acc[c.modulo].push(c);
    return acc;
  }, {});

  return (
    <div className="w-full h-full space-y-6 overflow-auto" data-context-required="true" data-permission="Sistema.Configuracoes.visualizar">
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Central de Configurações
          </CardTitle>
          <p className="text-sm text-slate-600 mt-1">Gerencie todas as configurações do sistema em um só lugar</p>
        </CardHeader>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={isFetching || !canLoad} onClick={() => { queryClient.invalidateQueries({ queryKey: ['config-center-v2'] }); refetch(); }} data-action="ConfigCenter.atualizar" data-permission="Sistema.Configuracoes.visualizar">
          🔄 Atualizar
        </Button>
      </div>

      <Tabs defaultValue="seguranca" className="w-full space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="seguranca"><Key className="w-4 h-4 mr-2" />Segurança</TabsTrigger>
          <TabsTrigger value="ia"><Sparkles className="w-4 h-4 mr-2" />Inteligência Artificial</TabsTrigger>
          <TabsTrigger value="backup"><Cloud className="w-4 h-4 mr-2" />Backup & Logs</TabsTrigger>
        </TabsList>

        {/* Tab Segurança */}
        <TabsContent value="seguranca">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Configurações de Segurança</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <ToggleRow configs={configs} chave="cc_auditoria_automatica" categoria="Seguranca" label="Auditoria Automática" desc="Registra todas as ações dos usuários automaticamente" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_ia_seguranca_ativa" categoria="Seguranca" label="IA de Segurança" desc="Detecta anomalias e comportamentos suspeitos" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_exigir_mfa" categoria="Seguranca" label="Autenticação de Dois Fatores (MFA)" desc="Exige verificação adicional no login" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_bloquear_ips_suspeitos" categoria="Seguranca" label="Bloquear IPs Suspeitos" desc="Bloqueia automaticamente IPs com comportamento anômalo" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab IA */}
        <TabsContent value="ia">
          <Card>
            <CardHeader className="bg-purple-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />Módulos de IA Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <ToggleRow configs={configs} chave="cc_ia_preditiva_vendas" categoria="Sistema" label="IA Preditiva de Vendas" desc="Previsão de demanda e churn de clientes" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_ia_conciliacao" categoria="Sistema" label="IA Conciliação Bancária" desc="Conciliação automática de extratos" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_ia_producao" categoria="Sistema" label="IA Produção" desc="Otimização de ordens de produção" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_ia_leitura_projetos" categoria="Sistema" label="IA Leitura de Projetos" desc="Análise automática de projetos de engenharia" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} accentColor="purple" disabled={!canLoad} />

              {Object.keys(modulosIA).length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Configurações por Módulo (IAConfig)</p>
                  {Object.entries(modulosIA).map(([modulo, cfgs]) => (
                    <div key={modulo} className="p-4 border rounded-lg">
                      <p className="font-semibold mb-2 text-sm">{modulo}</p>
                      <div className="space-y-1">
                        {cfgs.map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                            <div>
                              <p className="font-medium">{c.funcionalidade}</p>
                              <p className="text-xs text-slate-600">Modelo: {c.modelo_base} | Limite: {c.limite_tokens} tokens</p>
                            </div>
                            <Badge className={c.ativo ? 'bg-green-600' : 'bg-slate-600'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Backup */}
        <TabsContent value="backup">
          <Card>
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Backup e Retenção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <ToggleRow configs={configs} chave="cc_backup_automatico" categoria="Sistema" label="Backup Automático Diário" desc="Backup incremental de todas as entidades" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!canLoad} />
              <ToggleRow configs={configs} chave="cc_criptografia_dados" categoria="Seguranca" label="Criptografia de Dados Sensíveis" desc="Criptografa CPF, CNPJ e salários (AES-256)" saving={saving} isFetching={isFetching} onToggle={handleToggle} getToggleValue={getToggleValue} disabled={!canLoad} />

              {getConfig('cc_backup_automatico')?.updated_date && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Backup configurado com sucesso
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Última atualização: {new Date(getConfig('cc_backup_automatico').updated_date).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

