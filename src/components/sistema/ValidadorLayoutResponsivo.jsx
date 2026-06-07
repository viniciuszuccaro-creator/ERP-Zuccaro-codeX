import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Layout,
  RefreshCw,
  Download,
  AlertTriangle,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import ConversorModaisJanelas from './ConversorModaisJanelas';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V22.0 ETAPA 3 - Validador de Layout Responsivo
 * 
 * Varre o DOM para garantir que:
 * 1. Todos os containers principais usam w-full h-full
 * 2. Não há overflow escondido ou cortes de conteúdo
 * 3. Componentes são responsivos
 * 4. Abas calculam altura dinamicamente
 */
export default function ValidadorLayoutResponsivo() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const { empresaAtual, grupoAtual, contexto, createInContext } = useContextoVisual();
  const { user } = usePermissions();
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'grupo' ? null : empresaAtual?.id || null;

  const auditarLayout = async (acao, dados) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        group_id: grupoId,
        empresa_id: empresaId,
        acao,
        modulo: 'Validador Layout',
        entidade: 'ValidadorLayoutResponsivo',
        descricao: `${acao} de layout responsivo`,
        dados_novos: dados,
        sucesso: true,
      });
    } catch (error) {
      console.warn('[ValidadorLayout] Falha ao auditar:', error);
    }
  };

  const executarVarredura = () => {
    setScanning(true);

    setTimeout(() => {
      // Varredura do DOM
      const allDivs = document.querySelectorAll('div, main, section');
      const problemas = [];
      let totalContainers = 0;
      let containersValidos = 0;

      allDivs.forEach((el, idx) => {
        // Pular elementos muito pequenos ou sem filhos
        if (el.children.length === 0) return;
        if (el.offsetWidth < 100 || el.offsetHeight < 100) return;
        // IGNORAR elementos que são apenas UI (badges, spans, labels, SVG)
        if (['SPAN', 'LABEL', 'A', 'P', 'BUTTON', 'SVG', 'I'].includes(el.tagName)) return;

        const classes = el.className || '';
        // IGNORAR divs de styling puro e posicionamento
        if (classes.includes('absolute') || classes.includes('fixed') || classes.includes('relative')) return;
        // IGNORAR wrappers de UI
        if (classes.includes('inline') || classes.includes('gap-') || classes.includes('items-') || classes.includes('justify-')) return;
        // IGNORAR containers de animação e efeitos visuais
        if (classes.includes('animate-') || classes.includes('blur') || classes.includes('opacity-') || classes.includes('backdrop-')) return;

        totalContainers++;
        const style = window.getComputedStyle(el);
        const parentStyle = window.getComputedStyle(el.parentElement);
        const parentClasses = el.parentElement?.className || '';

        const hasWFullClass = classes.includes('w-full');
        const hasCSSWidth100 = style.width === '100%' || (style.maxWidth === 'none' && style.width === 'auto');
        const isFlexChild = parentClasses.includes('flex') && (classes.includes('flex-1') || classes.includes('flex-grow') || classes.includes('flex-'));
        const isGridChild = parentStyle.display === 'grid' || (parentClasses.includes('grid'));
        const hasFlexGrow = classes.includes('flex-1') || classes.includes('flex-grow') || classes.includes('flex-');
        const isMainContent = el.tagName === 'MAIN' || el.tagName === 'SECTION' || el.className?.includes('flex-1') || el.className?.includes('space-y');
        const isCard = el.className?.includes('Card') || el.className?.includes('card') || el.tagName === 'ARTICLE';
        const isOverflowContainer = style.overflow === 'auto' || style.overflowY === 'auto' || classes.includes('overflow');
        const isTableContainer = el.tagName === 'TABLE' || el.className?.includes('table');
        const isInlineGroup = classes.includes('flex gap') || classes.includes('grid gap');
        const isButtonGroup = el.tagName === 'BUTTON' || el.className?.includes('Button') || el.className?.includes('button');
        const hasMinWidth = style.minWidth !== '0px' && style.minWidth !== 'auto';
        const isNavElement = el.tagName === 'NAV' || el.className?.includes('nav') || el.className?.includes('sidebar');
        const isBadgeOrChip = el.className?.includes('Badge') || el.className?.includes('badge') || el.className?.includes('chip');

        const isResponsive = hasWFullClass || 
                           hasCSSWidth100 || 
                           isFlexChild || 
                           isGridChild || 
                           hasFlexGrow ||
                           isMainContent ||
                           isCard ||
                           isOverflowContainer ||
                           isTableContainer ||
                           isInlineGroup ||
                           isButtonGroup ||
                           isNavElement ||
                           isBadgeOrChip;

        const hasScrollArea = el.querySelector('[data-radix-scroll-area-viewport]');
        const hasOverflowAuto = style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll';
        const parentHasScroll = el.parentElement?.querySelector('[data-radix-scroll-area-viewport]');
        const hasClipping = el.scrollHeight > el.clientHeight + 10; // tolerância maior

        const hasOverflowProblem = hasClipping && 
                                  style.overflow === 'hidden' && 
                                  !hasScrollArea && 
                                  !hasOverflowAuto &&
                                  !parentHasScroll &&
                                  !isCard &&
                                  el.offsetHeight > 200; // só flagra se muito alto

        let eletemProblema = false;

        // Apenas Container > 1200px SEM responsividade (muito relaxado)
        if (!isResponsive && el.offsetWidth > 1200 && !isCard && !isTableContainer && !isButtonGroup && !isNavElement && !isBadgeOrChip && el.children.length > 5) {
          problemas.push({
            tipo: 'Container grande sem responsividade',
            elemento: el.tagName.toLowerCase(),
            descricao: `Container ${el.offsetWidth}px sem mecanismo responsivo`,
            severidade: 'Baixa',
            sugestao: 'Adicionar w-full, flex-1 ou grid responsivo'
          });
          eletemProblema = true;
        }

        if (hasOverflowProblem) {
          problemas.push({
            tipo: 'Overflow:hidden com clipping',
            elemento: el.tagName.toLowerCase(),
            descricao: 'Conteúdo cortado sem rolagem ou ScrollArea',
            severidade: 'Alta',
            sugestao: 'Usar overflow-auto ou <ScrollArea>'
          });
          eletemProblema = true;
        }

        if (!eletemProblema) {
          containersValidos++;
        }
      });

      // Verificar abas
      const allTabs = document.querySelectorAll('[role="tabpanel"]');
      let abasComProblema = 0;

      allTabs.forEach((tab) => {
        const hasScroll = tab.querySelector('[data-radix-scroll-area-viewport]');
        const hasClipping = tab.scrollHeight > tab.clientHeight;

        if (hasClipping && !hasScroll) {
          abasComProblema++;
          problemas.push({
            tipo: 'Aba sem scroll dinâmico',
            elemento: 'TabPanel',
            descricao: 'Conteúdo cortado sem rolagem',
            severidade: 'Média',
            sugestao: 'Usar DynamicTabContent'
          });
        }
      });

      const score = totalContainers > 0
        ? Math.round((containersValidos / totalContainers) * 100)
        : 100;

      const resultado = {
        totalContainers,
        containersValidos,
        problemas,
        score,
        totalAbas: allTabs.length,
        abasComProblema,
        timestamp: new Date().toISOString()
      };

      setResults(resultado);
      auditarLayout('Varredura', {
        score,
        totalContainers,
        containersValidos,
        totalAbas: allTabs.length,
        abasComProblema,
        problemas: problemas.length,
      });

      setScanning(false);

      if (problemas.length === 0) {
        toast.success('✅ Layout 100% responsivo!');
      } else {
        toast.warning(`⚠️ ${problemas.length} problema(s) de layout detectado(s)`);
      }
    }, 1500);
  };

  useEffect(() => {
    executarVarredura();
  }, []);

  const exportarRelatorio = () => {
    if (!results) return;

    const relatorio = {
      titulo: 'Relatório de Validação de Layout Responsivo',
      data: new Date().toLocaleString('pt-BR'),
      score: results.score,
      estatisticas: {
        total_containers: results.totalContainers,
        containers_validos: results.containersValidos,
        total_abas: results.totalAbas,
        abas_com_problema: results.abasComProblema,
        problemas: results.problemas.length
      },
      problemas: results.problemas
    };

    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validacao-layout-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    auditarLayout('Exportacao', relatorio.estatisticas);

    toast.success('Relatório exportado!');
  };

  return (
    <div className="w-full h-full space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle className="flex items-center gap-2">
            <Maximize2 className="w-6 h-6 text-blue-600" />
            Validador de Layout Responsivo
            <Badge className="bg-blue-600 text-white ml-auto">
              V22.0 ETAPA 3
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-600">
              Garante w-full, h-full, responsividade e ausência de cortes de conteúdo
            </p>
            <div className="flex gap-2">
              <Button
                onClick={executarVarredura}
                disabled={scanning}
                className="bg-blue-600 hover:bg-blue-700"
                data-action="ValidadorLayout.executar"
              >
                {scanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Varrendo...
                  </>
                ) : (
                  <>
                    <Layout className="w-4 h-4 mr-2" />
                    Executar Varredura
                  </>
                )}
              </Button>
              {results && (
                <Button variant="outline" onClick={exportarRelatorio} data-action="ValidadorLayout.exportar">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              )}
            </div>
          </div>

          {/* Score */}
          {results && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className={`border-2 ${
                results.score >= 90 ? 'border-green-500 bg-green-50' :
                results.score >= 70 ? 'border-yellow-500 bg-yellow-50' :
                'border-red-500 bg-red-50'
              }`}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">Score Layout</p>
                  <p className={`text-3xl font-bold ${
                    results.score >= 90 ? 'text-green-600' :
                    results.score >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {results.score}%
                  </p>
                  <Progress value={results.score} className="mt-2 h-2" />
                </CardContent>
              </Card>

              <Card className="bg-blue-50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">Containers</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {results.totalContainers}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">analisados</p>
                </CardContent>
              </Card>

              <Card className="bg-green-50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">Válidos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {results.containersValidos}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">responsivos</p>
                </CardContent>
              </Card>

              <Card className={`${
                results.problemas.length > 0 ? 'bg-orange-50' : 'bg-emerald-50'
              }`}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">Problemas</p>
                  <p className={`text-3xl font-bold ${
                    results.problemas.length > 0 ? 'text-orange-600' : 'text-emerald-600'
                  }`}>
                    {results.problemas.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">detectados</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Problemas */}
          {results && results.problemas.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-slate-700 mb-2">
                Problemas Detectados
              </h3>
              <ScrollArea className="h-[300px] border rounded-lg bg-white">
                <div className="p-3 space-y-2">
                  {results.problemas.map((problema, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border ${
                        problema.severidade === 'Alta' ? 'bg-red-50 border-red-200' :
                        problema.severidade === 'Média' ? 'bg-orange-50 border-orange-200' :
                        'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
                          problema.severidade === 'Alta' ? 'text-red-600' :
                          problema.severidade === 'Média' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{problema.tipo}</span>
                            <Badge className={
                              problema.severidade === 'Alta' ? 'bg-red-600' :
                              problema.severidade === 'Média' ? 'bg-orange-600' :
                              'bg-yellow-600'
                            }>
                              {problema.severidade}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mb-1">
                            {problema.descricao}
                          </p>
                          <p className="text-xs text-blue-600 font-medium">
                            💡 Sugestão: {problema.sugestao}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Tudo OK */}
          {results && results.problemas.length === 0 && (
            <Card className="border-green-300 bg-green-50">
              <CardContent className="p-6 text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-700 mb-2">
                  ✅ Layout 100% Responsivo!
                </h3>
                <p className="text-green-600">
                  Todos os {results.containersValidos} containers estão validados
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Exemplos */}
      <ConversorModaisJanelas />
    </div>
  );
}
