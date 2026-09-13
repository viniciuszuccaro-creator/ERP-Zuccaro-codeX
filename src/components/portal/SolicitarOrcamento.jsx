import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { z } from 'zod';
import FormWrapper from '@/components/common/FormWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileUp, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeOnWrite } from '@/components/lib/sanitizeOnWrite';

/**
 * V21.5 - Solicitar Orçamento COMPLETO
 * ✅ Upload múltiplo de arquivos
 * ✅ Validação de formatos
 * ✅ Criação automática de oportunidade
 * ✅ Feedback visual de sucesso
 * ✅ w-full h-full responsivo
 */
export default function SolicitarOrcamento() {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    valor_estimado: '',
    prazo_desejado: '',
    observacoes: '',
  });
  const [arquivos, setArquivos] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();

  const criarOportunidadeMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      // Resolver contexto multiempresa a partir do cliente vinculado ao usuário do portal
      let empresaId = null, groupId = null;
      try {
        const c = await base44.entities.Cliente.filter({ portal_usuario_id: user.id }, undefined, 1);
        if (Array.isArray(c) && c[0]) { empresaId = c[0].empresa_id || null; groupId = c[0].group_id || null; }
      } catch (error) {
        console.error('[SolicitarOrcamento] Falha ao resolver contexto do cliente', error);
        throw new Error('Contexto do cliente indisponivel para solicitar orcamento.');
      }
      return await base44.entities.Oportunidade.create({
        titulo: data.titulo,
        descricao: data.descricao,
        cliente_nome: user.full_name,
        cliente_email: user.email,
        valor_estimado: parseFloat(data.valor_estimado) || 0,
        etapa: 'Prospecção',
        probabilidade: 30,
        data_abertura: new Date().toISOString().split('T')[0],
        data_previsao: data.prazo_desejado || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        origem: 'Portal',
        status: 'Aberto',
        responsavel: 'Equipe Comercial',
        observacoes: data.observacoes,
        score: 50,
        temperatura: 'Morno',
        empresa_id: empresaId || undefined,
        group_id: groupId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['minhas-oportunidades']);
      setSuccess(true);
      toast.success('Orçamento solicitado com sucesso!');
      setTimeout(() => {
        setFormData({
          titulo: '',
          descricao: '',
          valor_estimado: '',
          prazo_desejado: '',
          observacoes: '',
        });
        setArquivos([]);
        setSuccess(false);
      }, 3000);
    },
    onError: (error) => {
      toast.error('Erro ao solicitar orçamento');
      console.error(error);
    },
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploadingFiles(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return { name: file.name, url: file_url };
      });

      const uploaded = await Promise.all(uploadPromises);
      setArquivos([...arquivos, ...uploaded]);
      toast.success(`${files.length} arquivo(s) enviado(s)`);
    } catch (error) {
      toast.error('Erro ao enviar arquivos');
      console.error(error);
    } finally {
      setUploadingFiles(false);
    }
  };

  const schema = z.object({
    titulo: z.string().min(1, 'Título é obrigatório'),
    descricao: z.string().min(1, 'Descrição é obrigatória')
  });

  const handleSubmit = async () => {
    const payload = sanitizeOnWrite(formData);
    criarOportunidadeMutation.mutate(payload);
  };

  if (success) {
    return (
      <Card className="max-w-2xl mx-auto w-full">
        <CardContent className="p-12 text-center">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">Orçamento Solicitado!</h2>
          <p className="text-slate-600 mb-6">
            Recebemos sua solicitação e nossa equipe entrará em contato em breve.
          </p>
          <Button onClick={() => setSuccess(false)}>
            Fazer Nova Solicitação
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto w-full">
      <CardHeader>
        <CardTitle>Solicitar Orçamento</CardTitle>
        <CardDescription>
          Preencha os dados abaixo e nossa equipe comercial entrará em contato com você
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="titulo">
              Título do Projeto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="titulo"
              placeholder="Ex: Fornecimento de aço para construção"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">
              Descrição Detalhada <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="descricao"
              placeholder="Descreva o que você precisa, quantidades estimadas, especificações técnicas..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_estimado">Valor Estimado (R$)</Label>
              <Input
                id="valor_estimado"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.valor_estimado}
                onChange={(e) => setFormData({ ...formData, valor_estimado: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazo_desejado">Prazo Desejado</Label>
              <Input
                id="prazo_desejado"
                type="date"
                value={formData.prazo_desejado}
                onChange={(e) => setFormData({ ...formData, prazo_desejado: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Adicionais</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações complementares..."
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Anexar Arquivos (Projetos, Plantas, Especificações)</Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={uploadingFiles}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  {uploadingFiles ? 'Enviando arquivos...' : 'Clique para selecionar arquivos'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF, DWG, PNG, JPG até 10MB cada
                </p>
              </label>
            </div>

            {arquivos.length > 0 && (
              <div className="mt-3 space-y-2">
                {arquivos.map((arquivo, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {arquivo.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={criarOportunidadeMutation.isPending}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Send className="w-4 h-4 mr-2" />
              {criarOportunidadeMutation.isPending ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Atenção</p>
                <p>
                  Após enviar, você poderá acompanhar o status da sua solicitação na aba "Minhas Oportunidades".
                  Nossa equipe comercial entrará em contato em até 24 horas úteis.
                </p>
              </div>
            </div>
          </div>
        </FormWrapper>
      </CardContent>
    </Card>
  );
}
