import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import IALeituraProjetoResultado from "./IALeituraProjetoResultado";
import { PROJECT_READING_SCHEMA, createSimulatedProjectReading, normalizeProjectReadingResponse } from "./iaLeituraProjetoData";
import { FileText, Sparkles, AlertCircle, Loader2 } from "lucide-react";

/**
 * IA de Leitura de Projeto
 * V21.1.2 - WINDOW MODE READY - Preparado para integração REAL com Azure OpenAI
 */
export default function IALeituraProjeto({ configuracao, windowMode = false }) {
  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId);
  const podeProcessar = isAdmin() || hasPermission("Sistema", "Integracoes", "executar");

  const auditarLeituraProjeto = async (acao, descricao, dadosNovos = null) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade: 'IALeituraProjeto',
        descricao,
        sucesso: !/^(Bloqueio|Erro)/.test(acao),
        dados_anteriores: null,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar leitura de projeto:', error);
    }
  };
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modoLeitura, setModoLeitura] = useState('leitura_mista');
  useEffect(() => {
    setArquivo(null);
    setResultado(null);
  }, [groupId, empresaId]);

  const resumoArquivo = () => ({
    tipo_arquivo: arquivo?.type || arquivo?.name?.split('.').pop()?.toLowerCase() || 'desconhecido',
    tamanho_mb: arquivo?.size ? Number((arquivo.size / 1024 / 1024).toFixed(2)) : null,
    modo_leitura: modoLeitura
  });

  const processarArquivo = async () => {
    if (!arquivo) {
      toast({
        title: "⚠️ Selecione um arquivo",
        description: "Por favor, faça upload de um arquivo de projeto.",
        variant: "destructive"
      });
      return;
    }

    if (!contextoValido) {
      await auditarLeituraProjeto('Bloqueio sem contexto', 'Tentativa de processar leitura de projeto sem grupo.', resumoArquivo());
      toast({ title: "Contexto obrigatorio", description: "Selecione um grupo antes de processar arquivos com IA.", variant: "destructive" });
      return;
    }

    if (!podeProcessar) {
      await auditarLeituraProjeto('Bloqueio por permissao', 'Tentativa de processar leitura de projeto sem permissao.', resumoArquivo());
      toast({ title: "Permissao negada", description: "Seu perfil nao permite processar projetos com IA.", variant: "destructive" });
      return;
    }

    setProcessando(true);
    setResultado(null);

    try {
      const modoSimulacao = configuracao?.integracao_ia_producao?.modo_simulacao !== false;

      if (!modoSimulacao && configuracao?.integracao_ia_producao?.ativada) {
        // MODO REAL - Integração com Azure OpenAI
        await processarComIAReal();
      } else {
        // MODO SIMULAÇÃO
        await processarSimulado();
      }
    } catch (error) {
      console.warn("Falha tecnica ao processar projeto com IA:", error);
      await auditarLeituraProjeto('Erro ao Processar Projeto com IA', 'A leitura de projeto falhou por erro tecnico.', {
        ...resumoArquivo(),
        tipo_erro: error?.name || 'Error'
      });
      toast({
        title: "Erro no processamento",
        description: 'Nao foi possivel processar o arquivo. Tente novamente.',
        variant: "destructive"
      });
    } finally {
      setProcessando(false);
    }
  };

  const processarComIAReal = async () => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });
    if (!file_url) throw new Error('InvalidUploadResponse');

    const promptIA = `
Você é um engenheiro especialista em leitura de projetos estruturais.
Analise o projeto anexado e extraia TODOS os elementos estruturais (vigas, colunas, blocos, etc.) de acordo com o modo de leitura solicitado (${modoLeitura}).

Para cada elemento, identifique as propriedades no schema JSON.
Seja preciso e detalhado. Retorne apenas elementos que você tem certeza, com confianca mínima de 70%.
Forneça as dimensões em milímetros (mm) e espaçamento de estribos em centímetros (cm).
    `;

    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt: promptIA,
      file_urls: [file_url],
      response_json_schema: PROJECT_READING_SCHEMA
    });

    const respostaNormalizada = normalizeProjectReadingResponse(resposta);
    const totalConfianca = respostaNormalizada.elementos_identificados.reduce((sum, el) => sum + el.confianca, 0);
    const confiancaGeral = respostaNormalizada.elementos_identificados.length > 0
      ? totalConfianca / respostaNormalizada.elementos_identificados.length
      : 0;

    setResultado({
      ...respostaNormalizada,
      modo: 'real',
      confianca_geral: confiancaGeral
    });

    await auditarLeituraProjeto('Processar Projeto com IA', 'Leitura real de projeto executada com escopo multiempresa.', {
      modo: 'real',
      ...resumoArquivo(),
      elementos_identificados: respostaNormalizada.elementos_identificados.length,
      confianca_geral: Number(confiancaGeral.toFixed(2))
    });

    toast({
      title: "✅ Sucesso na leitura com IA!",
      description: `${respostaNormalizada.elementos_identificados.length} elementos identificados pela IA!`,
      variant: "default"
    });
  };

  const processarSimulado = async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultadoSimulado = createSimulatedProjectReading();
    const elementosIdentificados = resultadoSimulado.elementos_identificados;
    const confiancaGeral = resultadoSimulado.confianca_geral;
    setResultado(resultadoSimulado);

    await auditarLeituraProjeto('Processar Projeto com IA', 'Leitura simulada de projeto executada com escopo multiempresa.', {
      modo: 'simulado',
      ...resumoArquivo(),
      elementos_identificados: elementosIdentificados.length,
      confianca_geral: Number(confiancaGeral.toFixed(2))
    });

    toast({
      title: "✨ Projeto processado com IA (simulação)!",
      description: `${elementosIdentificados.length} elementos detectados. Confiança média: ${confiancaGeral.toFixed(0)}%`
    });
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const tiposAceitos = ['application/pdf', 'image/png', 'image/jpeg', 'application/dwg', 'application/dxf'];
    if (!tiposAceitos.includes(file.type) && !file.name.match(/\.(pdf|dwg|dxf|png|jpg|jpeg)$/i)) {
      setArquivo(null);
      setResultado(null);
      toast({
        title: "⚠️ Tipo de arquivo não suportado",
        description: "Use PDF, DWG, DXF, PNG ou JPG",
        variant: "destructive"
      });
      return;
    }

    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setArquivo(null);
      setResultado(null);
      toast({
        title: "⚠️ Arquivo muito grande",
        description: "Tamanho máximo: 10MB",
        variant: "destructive"
      });
      return;
    }

    setArquivo(file);
    setResultado(null);
  };

  return (
    <div className={`w-full h-full space-y-6 ${windowMode ? 'overflow-auto p-6 bg-white' : ''}`}>
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            IA de Leitura de Projeto <Badge className="ml-2 bg-purple-200 text-purple-800">V12.0</Badge>
          </CardTitle>
          <p className="text-sm text-slate-600">
            Envie o arquivo do projeto e a IA identificará elementos estruturais automaticamente
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(!configuracao?.integracao_ia_producao?.ativada || configuracao?.integracao_ia_producao?.modo_simulacao) && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-900 text-sm">IA em modo de simulação</p>
                  <p className="text-orange-700 text-xs mt-1">
                    {configuracao?.integracao_ia_producao?.ativada ?
                      "A integração real está ativada, mas o modo de simulação está ativo. Desative-o nas Configurações para usar a IA real." :
                      "A IA não está ativada ou configurada. Configure a integração em Configurações do Sistema → Integrações para ativar a leitura real."
                    }
                    Por enquanto, o sistema funcionará em modo de demonstração.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="modoLeitura">Modo de Leitura</Label>
              <Select value={modoLeitura} onValueChange={setModoLeitura} disabled={!contextoValido || !podeProcessar}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modo de leitura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leitura_estrutural">Leitura Estrutural (Vigas/Colunas)</SelectItem>
                  <SelectItem value="corte_dobra">Corte e Dobra (Simples)</SelectItem>
                  <SelectItem value="leitura_mista">Leitura Mista (Estrutural + C&D)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="arquivoProjeto">Arquivo do Projeto</Label>
              <Input
                id="arquivoProjeto"
                type="file"
                accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                onChange={handleUpload}
                disabled={!contextoValido || !podeProcessar}
                data-permission="Sistema.Integracoes.executar"
                data-context-required="group"
              />
            </div>
          </div>

          {arquivo && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{arquivo.name}</p>
                  <p className="text-xs text-slate-600">
                    {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                onClick={processarArquivo}
                disabled={processando || !contextoValido || !podeProcessar}
                className="bg-purple-600 hover:bg-purple-700"
                data-action="Integracoes.IALeituraProjeto.processar"
                data-permission="Sistema.Integracoes.executar"
                data-context-required="group"
                data-sensitive="true"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Processar com IA
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <IALeituraProjetoResultado resultado={resultado} onClear={() => setResultado(null)} />

      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-purple-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-purple-900 mb-2">💡 Como funciona a IA</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>✓ Identifica vigas, colunas, blocos, estacas automaticamente</li>
                <li>✓ Reconhece bitolas, medidas e quantidades</li>
                <li>✓ Valida bitolas contra o estoque cadastrado (quando ativado)</li>
                <li>✓ Gera descrições técnicas automáticas</li>
                <li>✓ Permite conferência e edição manual (em futuras versões)</li>
                <li>✓ Integra diretamente com OPs e produção (quando ativado)</li>
              </ul>
              <p className="text-xs text-purple-700 mt-3">
                <strong>Provedores suportados (preparado):</strong> Azure OpenAI, OpenAI, Custom API, Local
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}