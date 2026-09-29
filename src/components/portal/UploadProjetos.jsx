import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileText, CheckCircle2, Clock, AlertCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { assertTechnicalUploadAllowed, assertConfirmedTechnicalUploadUrl, TECHNICAL_UPLOAD_ACCEPT } from '@/lib/technicalUploadPolicy';

/**
 * V21.5 - Upload de Projetos COMPLETO
 * ✅ Upload de arquivos PDF, DWG, DXF, Imagens
 * ✅ Validação de tamanho e tipo
 * ✅ Histórico de projetos enviados
 * ✅ Status de processamento IA
 * ✅ Geração automática de orçamento
 * ✅ 100% Responsivo w-full h-full
 */
export default function UploadProjetos({ clienteId, clienteNome }) {
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [descricaoProjeto, setDescricaoProjeto] = useState("");
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projetos = [] } = useQuery({
    queryKey: ['projetosCliente', clienteId],
    queryFn: async () => {
      // Buscar pedidos do cliente que têm projetos anexados
      const pedidos = await base44.entities.Pedido.filter({ cliente_id: clienteId }, '-created_date');
      
      const projetosCliente = [];
      pedidos.forEach(p => {
        if (p.projetos_ia && p.projetos_ia.length > 0) {
          p.projetos_ia.forEach(proj => {
            projetosCliente.push({
              ...proj,
              pedido_id: p.id,
              numero_pedido: p.numero_pedido,
              status_pedido: p.status
            });
          });
        }
      });
      
      return projetosCliente;
    },
    enabled: !!clienteId
  });

  const uploadProjetoMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      await assertTechnicalUploadAllowed(file);
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const confirmedUrl = assertConfirmedTechnicalUploadUrl(file_url);
      
      // Criar pedido rascunho com o projeto
      const pedido = await base44.entities.Pedido.create({
        numero_pedido: `PROJ-${Date.now()}`,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        data_pedido: new Date().toISOString().split('T')[0],
        tipo: 'Orçamento',
        tipo_pedido: 'Produção Sob Medida',
        status: 'Rascunho',
        valor_total: 0,
        observacoes_publicas: descricaoProjeto,
        projetos_ia: [{
          arquivo_url: confirmedUrl,
          arquivo_nome: file.name,
          tipo_arquivo: file.name.split('.').pop().toUpperCase(),
          data_upload: new Date().toISOString(),
          processado_ia: false,
          pecas_detectadas: 0,
          pecas_aprovadas: 0
        }]
      });

      return { pedido, file_url: confirmedUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetosCliente', clienteId] });
      setArquivoSelecionado(null);
      setDescricaoProjeto("");
      setUploading(false);
      toast({
        title: "✅ Projeto Enviado!",
        description: "Seu projeto foi enviado e está sendo analisado. Você receberá um orçamento em breve."
      });
    },
    onError: () => {
      setUploading(false);
      toast({
        title: "Erro no Upload",
        description: "Não foi possível enviar o projeto. Tente novamente.",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await assertTechnicalUploadAllowed(file);
        setArquivoSelecionado(file);
      } catch (error) {
        setArquivoSelecionado(null);
        toast({
          title: "Arquivo inválido",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleUpload = () => {
    if (arquivoSelecionado) {
      uploadProjetoMutation.mutate(arquivoSelecionado);
    }
  };

  return (
    <div className="space-y-6 w-full h-full">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Enviar Projeto</h2>
        <p className="text-sm text-slate-600">
          Envie PDF ou imagem para análise. Arquivos CAD aguardam validação de segurança.
        </p>
      </div>

      {/* Upload Form */}
      <Card className="border-0 shadow-md w-full">
        <CardContent className="p-6 w-full">
          <div className="space-y-4">
            <div>
              <Label>Arquivo do Projeto *</Label>
              <div className="mt-2">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    {arquivoSelecionado ? (
                      <>
                        <p className="text-sm text-slate-700 font-semibold">{arquivoSelecionado.name}</p>
                        <p className="text-xs text-slate-500">{(arquivoSelecionado.size / 1024).toFixed(0)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600">Clique para selecionar</p>
                        <p className="text-xs text-slate-500">PDF, JPG ou PNG (máx. 10MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept={TECHNICAL_UPLOAD_ACCEPT}
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div>
              <Label>Descrição do Projeto</Label>
              <Textarea
                value={descricaoProjeto}
                onChange={(e) => setDescricaoProjeto(e.target.value)}
                placeholder="Descreva brevemente seu projeto (opcional)..."
                rows={3}
                disabled={uploading}
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!arquivoSelecionado || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Projeto
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Projetos Enviados */}
      <Card className="border-0 shadow-md w-full">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Projetos Enviados
            <Badge className="ml-auto bg-blue-600 text-white">{projetos.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 w-full">
          {projetos.length > 0 ? (
            <div className="space-y-4">
              {projetos.map((proj, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-lg border hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-semibold">{proj.arquivo_nome}</p>
                          <p className="text-xs text-slate-500">
                            Enviado em {format(new Date(proj.data_upload), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                      </div>

                      {proj.pedido_id && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Pedido: {proj.numero_pedido}</Badge>
                          <Badge className={
                            proj.status_pedido === 'Entregue' ? 'bg-green-100 text-green-700' :
                            proj.status_pedido === 'Faturado' ? 'bg-purple-100 text-purple-700' :
                            proj.status_pedido === 'Em Produção' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }>
                            {proj.status_pedido}
                          </Badge>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-600">Status Processamento</p>
                          <div className="flex items-center gap-2 mt-1">
                            {proj.processado_ia ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-green-700 font-medium">Processado</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-4 h-4 text-yellow-600" />
                                <span className="text-yellow-700 font-medium">Aguardando</span>
                              </>
                            )}
                          </div>
                        </div>
                        {proj.pecas_detectadas > 0 && (
                          <div>
                            <p className="text-xs text-slate-600">Peças Detectadas</p>
                            <p className="font-semibold mt-1">{proj.pecas_detectadas} peças</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(proj.arquivo_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Upload className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-semibold">Nenhum projeto enviado</p>
              <p className="text-sm mt-2">Envie seus projetos para receber orçamentos rápidos</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
