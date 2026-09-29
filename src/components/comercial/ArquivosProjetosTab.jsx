import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { assertTechnicalUploadAllowed, assertConfirmedTechnicalUploadUrl, TECHNICAL_UPLOAD_ACCEPT } from '@/lib/technicalUploadPolicy';

/**
 * Aba 7: Arquivos e Projetos
 */
export default function ArquivosProjetosTab({ formData, setFormData }) {
  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const tipo = await assertTechnicalUploadAllowed(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const url = assertConfirmedTechnicalUploadUrl(file_url);

      const novoAnexo = {
        tipo,
        nome_arquivo: file.name,
        url,
        data_upload: new Date().toISOString()
      };

      setFormData(prev => ({
        ...prev,
        anexos: [...(prev?.anexos || []), novoAnexo]
      }));

      toast.success('✅ Arquivo anexado');
    } catch (error) {
      toast.error(error.message || 'Erro ao fazer upload');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
        <CardContent className="p-8 text-center">
          <Upload className="w-12 h-12 mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Anexar Arquivos
          </h3>
          <p className="text-sm text-blue-700 mb-4">
            PDF, JPG ou PNG (CAD aguarda validação de segurança)
          </p>
          
          <input
            type="file"
            accept={TECHNICAL_UPLOAD_ACCEPT}
            onChange={handleUpload}
            className="hidden"
            id="upload-anexo"
          />
          <label htmlFor="upload-anexo">
            <Button asChild>
              <span>
                <FileText className="w-4 h-4 mr-2" />
                Selecionar Arquivo
              </span>
            </Button>
          </label>
        </CardContent>
      </Card>

      {/* Lista de Anexos */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">
            Arquivos Anexados ({(formData?.anexos || []).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {formData?.anexos && formData.anexos.length > 0 ? (
            <div className="space-y-2">
              {formData.anexos.map((anexo, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">{anexo.nome_arquivo}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(anexo.data_upload).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{anexo.tipo}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(anexo.url, '_blank')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum arquivo anexado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projetos Processados por IA */}
      {formData?.projetos_ia && formData.projetos_ia.length > 0 && (
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader className="bg-purple-100 border-b">
            <CardTitle className="text-base">🤖 Projetos Processados por IA</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {formData.projetos_ia.map((projeto, index) => (
                <div
                  key={index}
                  className="p-3 bg-white rounded-lg border"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{projeto.arquivo_nome}</p>
                      <p className="text-xs text-slate-600">
                        {projeto.pecas_detectadas} peça(s) detectada(s) • Confiança: {projeto.confianca_media}%
                      </p>
                    </div>
                    <Badge className="bg-purple-600">IA</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
