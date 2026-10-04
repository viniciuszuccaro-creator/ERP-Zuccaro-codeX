import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Plus, Trash2, Eye, Download, Bot, Layers, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import VisualizadorPeca from './VisualizadorPeca';
import { assertTechnicalUploadAllowed, assertConfirmedTechnicalUploadUrl, assertTechnicalAiProcessingAllowed, TECHNICAL_UPLOAD_ACCEPT } from '@/lib/technicalUploadPolicy';

/**
 * V21.1 - Aba 4: Corte e Dobra (IA)
 * AGORA COM: etapa_obra_id + Consolidação + Visualizador Restaurado
 */
export default function CorteDobraIATab({ formData, setFormData, empresaId, onNext }) {
  const [posicaoSelecionada, setPosicaoSelecionada] = useState(null);
  const [editando, setEditando] = useState(null);
  const [processandoIA, setProcessandoIA] = useState(false);

  const { data: bitolas = [] } = useQuery({
    queryKey: ['bitolas', empresaId || formData?.empresa_id],
    queryFn: async () => {
      const empId = empresaId || formData?.empresa_id;
      const filter = empId
        ? { empresa_id: empId, eh_bitola: true, status: 'Ativo' }
        : { eh_bitola: true, status: 'Ativo' };
      return await base44.entities.Produto.filter(filter);
    },
    enabled: true
  });

  const formatosDisponiveis = [
    { id: 'reto', label: 'Reto', medidas: ['A'] },
    { id: 'L', label: 'L (1 dobra)', medidas: ['A', 'B'] },
    { id: 'U', label: 'U (2 dobras)', medidas: ['A', 'B', 'C'] },
    { id: 'Z', label: 'Z (3 dobras)', medidas: ['A', 'B', 'C', 'D'] },
    { id: 'gancho', label: 'Gancho', medidas: ['A', 'B', 'C'] },
    { id: 'estribo', label: 'Estribo', medidas: ['A', 'B'] }
  ];

  // V21.1: Etapas de Obra (mesmas da Aba 3)
  const etapasObra = [
    { id: 'fundacao', nome: 'Fundação' },
    { id: 'estrutura', nome: 'Estrutura' },
    { id: 'cobertura', nome: 'Cobertura' },
    { id: 'acabamento', nome: 'Acabamento' }
  ];

  const handleUploadIA = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      assertTechnicalAiProcessingAllowed();
      const tipoArquivo = await assertTechnicalUploadAllowed(file);
      setProcessandoIA(true);
      toast.info('Processando arquivo com IA...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const confirmedUrl = assertConfirmedTechnicalUploadUrl(file_url);

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise este projeto de estrutura metálica e extraia TODAS as posições de corte e dobra.
        
Para cada posição, retorne:
- codigo: Código da posição (N1, N2, etc.)
- bitola: Diâmetro da bitola em mm (ex: 6.3, 8.0, 10.0, 12.5, 16.0, 20.0, 25.0)
- formato: Tipo de dobra (reto, L, U, Z, gancho, estribo)
- quantidade: Quantidade de barras
- medidas: Objeto com medidas A, B, C, D em centímetros
- etapa: Fase da obra (fundacao, estrutura, cobertura) se identificável

Retorne APENAS posições claramente identificadas.`,
        file_urls: [confirmedUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            posicoes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  codigo: { type: 'string' },
                  bitola: { type: 'string' },
                  formato: { type: 'string' },
                  quantidade: { type: 'number' },
                  etapa: { type: 'string' },
                  medidas: {
                    type: 'object',
                    properties: {
                      A: { type: 'number' },
                      B: { type: 'number' },
                      C: { type: 'number' },
                      D: { type: 'number' }
                    }
                  }
                }
              }
            },
            confianca: { type: 'number' },
            observacoes: { type: 'string' }
          }
        }
      });

      if (resultado.posicoes && resultado.posicoes.length > 0) {
        const posicoesComPeso = resultado.posicoes.map(pos => {
          const pesoEstimado = calcularPesoPosicao(pos, bitolas);
          return {
            ...pos,
            peso_kg: pesoEstimado,
            origem_ia: true,
            confianca_ia: resultado.confianca || 85,
            etapa_obra_id: pos.etapa || '',
            etapa_obra_nome: etapasObra.find(e => e.id === pos.etapa)?.nome || ''
          };
        });

        setFormData(prev => ({
          ...prev,
          itens_corte_dobra: [...(prev?.itens_corte_dobra || []), ...posicoesComPeso],
          projetos_ia: [
            ...(prev?.projetos_ia || []),
            {
              arquivo_url: confirmedUrl,
              arquivo_nome: file.name,
              tipo_arquivo: tipoArquivo,
              processado_ia: true,
              data_processamento: new Date().toISOString(),
              pecas_detectadas: resultado.posicoes.length,
              confianca_media: resultado.confianca
            }
          ]
        }));

        toast.success(`✅ ${resultado.posicoes.length} posição(ões) extraída(s) com IA!`);
      } else {
        toast.error('❌ Nenhuma posição foi detectada pela IA');
      }
    } catch (error) {
      console.error('Erro ao processar IA:', error);
      toast.error('❌ Erro ao processar arquivo');
    } finally {
      setProcessandoIA(false);
    }
  };

  const calcularPesoPosicao = (posicao, bitolas) => {
    const bitola = bitolas.find(b => b.bitola_diametro_mm === parseFloat(posicao.bitola));
    const pesoMetro = bitola?.peso_teorico_kg_m || 1.0;

    const medidas = posicao.medidas || {};
    const comprimentoTotal = Object.values(medidas).reduce((sum, val) => sum + (val || 0), 0);
    const comprimentoMetros = comprimentoTotal / 100;

    return comprimentoMetros * pesoMetro * (posicao.quantidade || 1);
  };

  const adicionarManual = () => {
    const novaPosicao = {
      codigo: `N${((formData?.itens_corte_dobra || []).length) + 1}`,
      bitola: '',
      formato: 'reto',
      quantidade: 1,
      medidas: { A: 0 },
      etapa_obra_id: '', // V21.1
      etapa_obra_nome: '', // V21.1
      origem_ia: false
    };
    setEditando(novaPosicao);
  };

  const salvarPosicao = () => {
    if (!editando.bitola || !editando.quantidade) {
      toast.error('Preencha bitola e quantidade');
      return;
    }

    const pesoCalculado = calcularPesoPosicao(editando, bitolas);
    const posicaoFinal = { ...editando, peso_kg: pesoCalculado };

    if (editando.index !== undefined) {
      const novasPos = [...(formData?.itens_corte_dobra || [])];
      novasPos[editando.index] = posicaoFinal;
      setFormData(prev => ({ ...prev, itens_corte_dobra: novasPos }));
    } else {
      setFormData(prev => ({
        ...prev,
        itens_corte_dobra: [...(prev?.itens_corte_dobra || []), posicaoFinal]
      }));
    }

    setEditando(null);
    toast.success('✅ Posição salva');
  };

  const removerPosicao = (index) => {
    setFormData(prev => ({
      ...prev,
      itens_corte_dobra: (prev?.itens_corte_dobra || []).filter((_, i) => i !== index)
    }));
    toast.success('✅ Posição removida');
  };

  // V21.1: Consolidar por Etapa
  const consolidarPorEtapa = () => {
    const itensComEtapa = formData.itens_corte_dobra.filter(p => p.etapa_obra_id);

    if (itensComEtapa.length === 0) {
      toast.error('Nenhuma posição possui etapa de obra definida');
      return;
    }

    const etapas = {};
    itensComEtapa.forEach(pos => {
      const etapaId = pos.etapa_obra_id;
      if (!etapas[etapaId]) {
        etapas[etapaId] = {
          etapa_obra_id: etapaId,
          etapa_obra_nome: pos.etapa_obra_nome,
          posicoes: [],
          peso_total_kg: 0
        };
      }
      etapas[etapaId].posicoes.push(pos);
      etapas[etapaId].peso_total_kg += pos.peso_kg || 0;
    });

    const resumo = Object.values(etapas);
    toast.success(`📊 Consolidado em ${resumo.length} etapa(s) de obra`);
    // Here you would typically set this summary to state to display it,
    // or pass it to the next step. For now, it just triggers a toast.
    console.log("Resumo por Etapa:", resumo);
    return resumo;
  };

  const formatoSelecionado = formatosDisponiveis.find(f => f.id === editando?.formato);

  return (
    <div className="grid grid-cols-2 gap-6" style={{ height: 'calc(100vh - 400px)' }}>
      {/* LADO ESQUERDO: Planilha */}
      <div className="space-y-4 overflow-auto">
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-600" />
              Upload com IA (DWG/PDF)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept={TECHNICAL_UPLOAD_ACCEPT}
              onChange={handleUploadIA}
              className="hidden"
              id="upload-ia"
              disabled={processandoIA}
            />
            <label htmlFor="upload-ia">
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-700" disabled={processandoIA}>
                <span>
                  {processandoIA ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Processando IA...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Selecionar PDF ou imagem para análise
                    </>
                  )}
                </span>
              </Button>
            </label>
            <p className="text-xs text-purple-700 mt-2 text-center">
              A IA extrairá automaticamente posições + etapas da obra
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Adicionar Posição Manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!editando ? (
              <Button onClick={adicionarManual} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Nova Posição
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Código</Label>
                    <Input
                      placeholder="Ex: N1"
                      value={editando.codigo}
                      onChange={(e) => setEditando({ ...editando, codigo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editando.quantidade}
                      onChange={(e) => setEditando({ ...editando, quantidade: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bitola</Label>
                    <Select
                      value={editando.bitola}
                      onValueChange={(value) => setEditando({ ...editando, bitola: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="z-[99999]">
                        {bitolas.map((b) => (
                          <SelectItem key={b.id} value={b.bitola_diametro_mm.toString()}>
                            {b.bitola_diametro_mm}mm ({b.tipo_aco})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Formato</Label>
                    <Select
                      value={editando.formato}
                      onValueChange={(value) => {
                        const formato = formatosDisponiveis.find(f => f.id === value);
                        const medidas = {};
                        formato.medidas.forEach(m => medidas[m] = 0);
                        setEditando({ ...editando, formato: value, medidas });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[99999]">
                        {formatosDisponiveis.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* V21.1: Etapa da Obra */}
                <div>
                  <Label className="text-xs flex items-center gap-1 text-purple-600">
                    <Layers className="w-3 h-3" />
                    Etapa da Obra (opcional)
                  </Label>
                  <Select
                    value={editando.etapa_obra_id}
                    onValueChange={(value) => {
                      const etapa = etapasObra.find(e => e.id === value);
                      setEditando({
                        ...editando,
                        etapa_obra_id: value,
                        etapa_obra_nome: etapa?.nome || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {etapasObra.map(etapa => (
                        <SelectItem key={etapa.id} value={etapa.id}>
                          {etapa.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Medidas Dinâmicas */}
                {formatoSelecionado && (
                  <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 rounded">
                    {formatoSelecionado.medidas.map((medida) => (
                      <div key={medida}>
                        <Label className="text-xs">{medida} (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={editando.medidas?.[medida] || ''}
                          onChange={(e) => setEditando({
                            ...editando,
                            medidas: {
                              ...(editando.medidas || {}),
                              [medida]: parseFloat(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => setEditando(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={salvarPosicao}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Salvar Posição
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Planilha de Posições ({formData.itens_corte_dobra?.length || 0})</span>
              {/* V21.1: Botão Consolidar */}
              {formData.itens_corte_dobra && formData.itens_corte_dobra.length > 0 && (
                <Button
                  onClick={consolidarPorEtapa}
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-600"
                >
                  <Layers className="w-3 h-3 mr-2" />
                  Consolidar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {formData.itens_corte_dobra && formData.itens_corte_dobra.length > 0 ? (
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Pos</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Bitola</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Medidas</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.itens_corte_dobra.map((pos, index) => (
                      <TableRow
                        key={index}
                        className={`cursor-pointer hover:bg-blue-50 ${posicaoSelecionada === index ? 'bg-blue-100' : ''}`}
                        onClick={() => setPosicaoSelecionada(index)}
                      >
                        <TableCell className="font-mono font-bold">{pos.codigo}</TableCell>
                        <TableCell>
                          {pos.etapa_obra_nome ? (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">
                              {pos.etapa_obra_nome}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pos.bitola}mm
                          {pos.origem_ia && (
                            <Badge className="ml-1 bg-purple-600 text-xs">IA</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{pos.formato}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {Object.entries(pos.medidas || {}).map(([k, v]) => (
                            <span key={k} className="mr-2">
                              {k}:{v}cm
                            </span>
                          ))}
                        </TableCell>
                        <TableCell>{pos.quantidade}</TableCell>
                        <TableCell className="font-semibold">
                          {pos.peso_kg?.toFixed(2)} kg
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removerPosicao(index);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Upload className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhuma posição adicionada</p>
                <p className="text-sm mt-1">Use IA ou adicione manualmente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* V21.1: Gerar para Orçamento */}
        {formData.itens_corte_dobra && formData.itens_corte_dobra.length > 0 && (
          <Button
            onClick={() => {
              toast.success('✅ Posições disponíveis para próxima etapa');
              onNext();
            }}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Próximo: Histórico do Cliente
          </Button>
        )}
      </div>

      {/* LADO DIREITO: V21.1 - Visualizador RESTAURADO */}
      <div className="border-2 border-slate-200 rounded-lg bg-white overflow-hidden sticky top-0">
        <div className="p-3 bg-slate-50 border-b">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-600" />
            Visualizador de Peça
          </h3>
        </div>
        <VisualizadorPeca
          posicao={posicaoSelecionada !== null ? formData.itens_corte_dobra[posicaoSelecionada] : null}
        />
      </div>
    </div>
  );
}
