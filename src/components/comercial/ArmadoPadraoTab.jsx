import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Layers } from 'lucide-react';
import { toast } from 'sonner';
import ArmadoPadraoItems from './armado-padrao/ArmadoPadraoItems';
import {
  calcularPeca,
  consolidarItensPorEtapa,
  ETAPAS_OBRA,
  gerarItensRevenda,
  TIPOS_PECA
} from './armado-padrao/armadoPadraoPolicy';

/** @typedef {import('./armado-padrao/armadoPadraoPolicy.js').ArmadoItem} ArmadoItem */
/** @typedef {import('./armado-padrao/armadoPadraoPolicy.js').TipoPeca} TipoPeca */
/** @typedef {import('./armado-padrao/armadoPadraoPolicy.js').Bitola} Bitola */

/**
 * @typedef {{
 *   group_id?: string,
 *   empresa_id?: string,
 *   itens_armado_padrao?: ArmadoItem[],
 *   itens_revenda?: Array<Record<string, unknown>>,
 *   [key: string]: unknown
 * }} PedidoArmadoFormData
 */

/**
 * V21.1 - Aba 3: Armado Padrão
 * AGORA COM: etapa_obra_id + Consolidação por Etapa
 */
/**
 * @param {{formData: PedidoArmadoFormData, setFormData: React.Dispatch<React.SetStateAction<PedidoArmadoFormData>>, empresaId?: string, onNext: () => void}} props
 */
export default function ArmadoPadraoTab({ formData, setFormData, empresaId, onNext }) {
  const [tipoPeca, setTipoPeca] = useState(/** @type {TipoPeca|null} */ (null));
  const [dadosPeca, setDadosPeca] = useState(/** @type {ArmadoItem} */ ({}));
  const [pecaEditandoIndex, setPecaEditandoIndex] = useState(/** @type {number|null} */ (null));

  const { data: bitolas = [] } = useQuery({
    queryKey: ['bitolas', formData?.group_id, empresaId || formData?.empresa_id],
    queryFn: async () => {
      const empId = empresaId || formData?.empresa_id;
      if (!empId) return [];
      const filter = {
        ...(formData?.group_id ? { group_id: formData.group_id } : {}),
        empresa_id: empId,
        eh_bitola: true,
        status: 'Ativo'
      };
      return /** @type {Promise<Bitola[]>} */ (base44.entities.Produto.filter(filter));
    },
    enabled: Boolean(empresaId || formData?.empresa_id)
  });

  const adicionarOuEditarPeca = () => {
    if (!tipoPeca) {
      toast.error('Selecione um tipo de peça');
      return;
    }

    const pecaCalculada = calcularPeca(tipoPeca, dadosPeca);

    setFormData(prev => {
      const novosItens = [...(prev.itens_armado_padrao || [])];
      if (pecaEditandoIndex !== null) {
        novosItens[pecaEditandoIndex] = pecaCalculada;
        toast.success('✅ Peça atualizada');
      } else {
        novosItens.push(pecaCalculada);
        toast.success('✅ Peça adicionada');
      }
      return {
        ...prev,
        itens_armado_padrao: novosItens
      };
    });

    // Reset
    setTipoPeca(null);
    setDadosPeca({});
    setPecaEditandoIndex(null);
  };

  /** @param {number} index */
  const removerPeca = (index) => {
    setFormData(prev => ({
      ...prev,
      itens_armado_padrao: (prev.itens_armado_padrao || []).filter((_, i) => i !== index)
    }));
    toast.success('✅ Peça removida');
  };

  /** @param {number} index */
  const editarPeca = (index) => {
    const pecaParaEditar = (formData.itens_armado_padrao || [])[index];
    if (!pecaParaEditar?.tipo_peca) return;
    setTipoPeca(pecaParaEditar.tipo_peca);
    setDadosPeca(pecaParaEditar);
    setPecaEditandoIndex(index);
    toast.info('✏️ Editando peça');
  };

  // V21.1: Consolidar por Etapa de Obra
  const consolidarPorEtapa = () => {
    const resumo = consolidarItensPorEtapa(formData.itens_armado_padrao || []);
    if (resumo.length === 0) {
      toast.error('Nenhum item possui etapa de obra definida');
      return;
    }
    toast.success(`📊 Consolidado em ${resumo.length} etapa(s) de obra`);
    return resumo;
  };

  const gerarItensComerciais = () => {
    const itensComerciais = gerarItensRevenda(formData.itens_armado_padrao || []);

    setFormData(prev => ({
      ...prev,
      itens_revenda: [...(prev.itens_revenda || []), ...itensComerciais]
    }));

    toast.success(`✅ ${itensComerciais.length} peça(s) enviada(s) para Aba Revenda`); // V21.1
    onNext();
  };

  return (
    <div className="w-full h-full space-y-6 overflow-auto">
      {/* Seleção de Tipo */}
      {!tipoPeca && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selecione o Tipo de Peça</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {TIPOS_PECA.map((tipo) => (
                <button
                  key={tipo.id}
                  onClick={() => setTipoPeca(/** @type {TipoPeca} */ (tipo.id))}
                  className="p-6 border-2 border-slate-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
                >
                  <div className="text-5xl mb-3">{tipo.icon}</div>
                  <p className="font-bold text-lg text-slate-900 group-hover:text-blue-600">
                    {tipo.label}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{tipo.descricao}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário Dinâmico */}
      {tipoPeca && (
        <Card className="border-2 border-blue-600">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Configurar {TIPOS_PECA.find(t => t.id === tipoPeca)?.label}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTipoPeca(null);
                  setDadosPeca({});
                }}
              >
                Trocar Tipo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Campos Comuns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <Label>Identificador</Label>
                <Input
                  placeholder="Ex: V1, C2"
                  value={dadosPeca.identificador || ''}
                  onChange={(e) => setDadosPeca({ ...dadosPeca, identificador: e.target.value })}
                />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={dadosPeca.quantidade || 1}
                  onChange={(e) => setDadosPeca({ ...dadosPeca, quantidade: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Comprimento (m)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dadosPeca.comprimento || ''}
                  onChange={(e) => setDadosPeca({ ...dadosPeca, comprimento: parseFloat(e.target.value) })}
                />
              </div>

              {/* V21.1: Etapa da Obra */}
              <div>
                <Label className="flex items-center gap-1 text-purple-600">
                  <Layers className="w-3 h-3" />
                  Etapa da Obra
                </Label>
                <Select
                  value={dadosPeca.etapa_obra_id}
                  onValueChange={(value) => {
                    const etapa = ETAPAS_OBRA.find(e => e.id === value);
                    setDadosPeca({ 
                      ...dadosPeca, 
                      etapa_obra_id: value,
                      etapa_obra_nome: etapa?.nome 
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    {ETAPAS_OBRA.map(etapa => (
                      <SelectItem key={etapa.id} value={etapa.id}>
                        {etapa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos de BLOCO */}
            {tipoPeca === 'bloco' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label>Altura (cm)</Label>
                  <Input
                    type="number"
                    value={dadosPeca.altura || ''}
                    onChange={(e) => setDadosPeca({ ...dadosPeca, altura: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Largura (cm)</Label>
                  <Input
                    type="number"
                    value={dadosPeca.largura || ''}
                    onChange={(e) => setDadosPeca({ ...dadosPeca, largura: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Espaçamento (cm)</Label>
                  <Input
                    type="number"
                    value={dadosPeca.espacamento || 15}
                    onChange={(e) => setDadosPeca({ ...dadosPeca, espacamento: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Bitola Principal</Label>
                  <Select
                    value={dadosPeca.bitola_principal}
                    onValueChange={(value) => setDadosPeca({ ...dadosPeca, bitola_principal: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {bitolas.map((b) => (
                        <SelectItem key={b.id} value={b.bitola_diametro_mm + 'mm'}>
                          {b.bitola_diametro_mm}mm ({b.tipo_aco})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Campos de COLUNA/VIGA/ESTACA */}
            {(tipoPeca === 'coluna' || tipoPeca === 'viga' || tipoPeca === 'estaca') && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <Label>Bitola Principal (CA-50)</Label>
                    <Select
                      value={dadosPeca.bitola_principal}
                      onValueChange={(value) => setDadosPeca({ ...dadosPeca, bitola_principal: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="z-[99999]">
                        {bitolas.filter(b => b.tipo_aco === 'CA-50').map((b) => (
                          <SelectItem key={b.id} value={b.bitola_diametro_mm + 'mm'}>
                            {b.bitola_diametro_mm}mm (CA-50)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Qtd Ferros Principais</Label>
                    <Input
                      type="number"
                      min="1"
                      value={dadosPeca.quantidade_ferros_principais || 4}
                      onChange={(e) => setDadosPeca({ ...dadosPeca, quantidade_ferros_principais: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Bitola Reforço (CA-50)</Label>
                    <Select
                      value={dadosPeca.reforco_bitola || ''}
                      onValueChange={(value) => setDadosPeca({ ...dadosPeca, reforco_bitola: value === '__nenhum__' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent className="z-[99999]">
                        <SelectItem value="__nenhum__">Nenhum</SelectItem>
                        {bitolas.filter(b => b.tipo_aco === 'CA-50').map((b) => (
                          <SelectItem key={b.id} value={b.bitola_diametro_mm + 'mm'}>
                            {b.bitola_diametro_mm}mm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Qtd Ferros Reforço</Label>
                    <Input
                      type="number"
                      min="0"
                      value={dadosPeca.reforco_quantidade || 0}
                      onChange={(e) => setDadosPeca({ ...dadosPeca, reforco_quantidade: parseInt(e.target.value) })}
                      disabled={!dadosPeca.reforco_bitola}
                      className={!dadosPeca.reforco_bitola ? 'bg-slate-100' : ''}
                    />
                  </div>
                </div>

                {/* Dobras */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={dadosPeca.dobra_l1}
                      onCheckedChange={(checked) => setDadosPeca({ ...dadosPeca, dobra_l1: checked })}
                    />
                    <Label>Dobra L1 (cm)</Label>
                    {dadosPeca.dobra_l1 && (
                      <Input
                        type="number"
                        className="w-24"
                        value={dadosPeca.dobra_lado1 || ''}
                        onChange={(e) => setDadosPeca({ ...dadosPeca, dobra_lado1: parseFloat(e.target.value) })}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={dadosPeca.dobra_l2}
                      onCheckedChange={(checked) => setDadosPeca({ ...dadosPeca, dobra_l2: checked })}
                    />
                    <Label>Dobra L2 (cm)</Label>
                    {dadosPeca.dobra_l2 && (
                      <Input
                        type="number"
                        className="w-24"
                        value={dadosPeca.dobra_lado2 || ''}
                        onChange={(e) => setDadosPeca({ ...dadosPeca, dobra_lado2: parseFloat(e.target.value) })}
                      />
                    )}
                  </div>
                </div>

                {/* Estribos */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Configuração de Estribos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div>
                      <Label>Bitola Estribo</Label>
                      <Select
                        value={dadosPeca.estribo_bitola}
                        onValueChange={(value) => setDadosPeca({ ...dadosPeca, estribo_bitola: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="z-[99999]">
                          {bitolas.filter(b => b.tipo_aco === 'CA-60' || b.bitola_diametro_mm <= 8).map((b) => (
                            <SelectItem key={b.id} value={b.bitola_diametro_mm + 'mm'}>
                              {b.bitola_diametro_mm}mm
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {tipoPeca === 'estaca' ? (
                      <div>
                        <Label>Diâmetro (cm)</Label>
                        <Input
                          type="number"
                          value={dadosPeca.estribo_diametro || ''}
                          onChange={(e) => setDadosPeca({ ...dadosPeca, estribo_diametro: parseFloat(e.target.value) })}
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label>Largura (cm)</Label>
                          <Input
                            type="number"
                            value={dadosPeca.estribo_largura || ''}
                            onChange={(e) => setDadosPeca({ ...dadosPeca, estribo_largura: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Altura (cm)</Label>
                          <Input
                            type="number"
                            value={dadosPeca.estribo_altura || ''}
                            onChange={(e) => setDadosPeca({ ...dadosPeca, estribo_altura: parseFloat(e.target.value) })}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label>Distância (cm)</Label>
                      <Input
                        type="number"
                        value={dadosPeca.distancia_estribo || 20}
                        onChange={(e) => setDadosPeca({ ...dadosPeca, distancia_estribo: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  {(tipoPeca === 'coluna' || tipoPeca === 'viga') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <Label>Lado Sem Estribo</Label>
                        <Select
                          value={dadosPeca.lado_sem_estribo}
                          onValueChange={(value) => setDadosPeca({ ...dadosPeca, lado_sem_estribo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="z-[99999]">
                            <SelectItem value="nenhum">Nenhum</SelectItem>
                            <SelectItem value="esquerda">Esquerda</SelectItem>
                            <SelectItem value="direita">Direita</SelectItem>
                            <SelectItem value="ambos">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {dadosPeca.lado_sem_estribo !== 'nenhum' && dadosPeca.lado_sem_estribo && (
                        <div>
                          <Label>Metragem Sem Estribo (cm)</Label>
                          <Input
                            type="number"
                            value={dadosPeca.metragem_sem_estribo || ''}
                            onChange={(e) => setDadosPeca({ ...dadosPeca, metragem_sem_estribo: parseFloat(e.target.value) })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <Button
              onClick={adicionarOuEditarPeca}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              {pecaEditandoIndex !== null ? '💾 Salvar Edição' : 'Adicionar Peça ao Pedido'}
            </Button>
            {pecaEditandoIndex !== null && (
              <Button
                onClick={() => {
                  setTipoPeca(null);
                  setDadosPeca({});
                  setPecaEditandoIndex(null);
                  toast.info('❌ Edição cancelada');
                }}
                variant="outline"
                className="w-full mt-2"
                size="lg"
              >
                Cancelar Edição
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ArmadoPadraoItems
        itens={formData.itens_armado_padrao || []}
        onConsolidar={consolidarPorEtapa}
        onGerarRevenda={gerarItensComerciais}
        onEditar={editarPeca}
        onRemover={removerPeca}
      />
    </div>
  );
}
