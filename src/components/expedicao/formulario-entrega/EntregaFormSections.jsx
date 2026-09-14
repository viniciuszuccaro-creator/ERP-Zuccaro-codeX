import React from 'react';
import { AlertCircle, CheckCircle2, MapPin, Phone, Zap } from 'lucide-react';
import BuscaCEP from '@/components/comercial/BuscaCEP';
import FormWrapper from '@/components/common/FormWrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** @typedef {import('./entregaFormPolicy').EntregaFormData} EntregaFormData */
/** @typedef {(next: EntregaFormData|((previous: EntregaFormData) => EntregaFormData)) => void} SetEntregaFormData */

/**
 * @param {{
 *  formData: EntregaFormData,
 *  setFormData: SetEntregaFormData,
 *  clientes: Array<Record<string, any>>,
 *  pedidos: Array<Record<string, any>>,
 *  empresasDoGrupo: Array<Record<string, any>>,
 *  estaNoGrupo: boolean,
 *  isEditing: boolean,
 *  windowMode: boolean,
 *  contextoValido: boolean,
 *  canSaveEntrega: boolean,
 *  isSubmitting: boolean,
 *  calculandoPrevisao: boolean,
 *  previsaoIA: Record<string, any>|null,
 *  onClienteChange: (id: string) => void,
 *  onPedidoChange: (id: string) => void,
 *  onCalcularPrevisao: () => void,
 *  onAplicarPrevisao: () => void,
 *  onBuscarGeolocalizacao: () => void,
 *  onSubmit: () => void,
 *  onCancel: () => void
 * }} props
 */
export default function EntregaFormSections({
  formData,
  setFormData,
  clientes,
  pedidos,
  empresasDoGrupo,
  estaNoGrupo,
  isEditing,
  windowMode,
  contextoValido,
  canSaveEntrega,
  isSubmitting,
  calculandoPrevisao,
  previsaoIA,
  onClienteChange,
  onPedidoChange,
  onCalcularPrevisao,
  onAplicarPrevisao,
  onBuscarGeolocalizacao,
  onSubmit,
  onCancel,
}) {
  const endereco = formData.endereco_entrega_completo;
  const contato = formData.contato_entrega;
  const permission = isEditing ? 'Expedicao.Entrega.editar' : 'Expedicao.Entrega.criar';

  const content = (
    <div className="w-full h-full">
      {(!contextoValido || !canSaveEntrega) && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {!contextoValido
            ? 'Selecione Grupo e uma empresa autorizada para salvar entregas.'
            : 'Seu perfil nao tem permissao para salvar entregas.'}
        </div>
      )}

      <FormWrapper
        schema={null}
        defaultValues={formData}
        onSubmit={onSubmit}
        externalData={formData}
        withContext={false}
        className={`w-full h-full space-y-6 ${windowMode ? 'p-6 overflow-auto' : ''}`}
        data-permission={permission}
        data-context-required="true"
      >
        {estaNoGrupo && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <Label>Empresa Responsavel *</Label>
            <Select
              value={formData.empresa_id || ''}
              onValueChange={(value) => setFormData({ ...formData, empresa_id: value })}
              required
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {empresasDoGrupo.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome_fantasia || empresa.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <section className="space-y-4">
          <h3 className="font-semibold text-slate-900 border-b pb-2">Dados Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Pedido Relacionado</Label>
              <Select value={formData.pedido_id || ''} onValueChange={onPedidoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione um pedido" /></SelectTrigger>
                <SelectContent>
                  {pedidos.map((pedido) => (
                    <SelectItem key={pedido.id} value={pedido.id}>
                      {pedido.numero_pedido} - {pedido.cliente_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente *</Label>
              <Select value={formData.cliente_id || ''} onValueChange={onClienteChange} required>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome || cliente.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Data Previsao</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={formData.data_previsao || ''}
                  onChange={(event) => setFormData({ ...formData, data_previsao: event.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={onCalcularPrevisao}
                  disabled={calculandoPrevisao || !contextoValido || !canSaveEntrega}
                  data-action="Entrega.previsao_ia"
                  data-permission={permission}
                  data-context-required="true"
                  data-sensitive="true"
                  variant="outline"
                  title="Calcular com IA"
                >
                  <Zap className="w-4 h-4" />
                </Button>
              </div>
              {previsaoIA && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-green-700">
                    IA sugeriu: {previsaoIA.data_prevista || '-'} · {previsaoIA.prazo_dias || 0} dia(s) · {previsaoIA.confianca_percentual || 0}% confianca
                  </p>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-green-300 text-green-800" onClick={onAplicarPrevisao} data-action="Entrega.previsao_ia.aplicar">
                    Confirmar e aplicar data sugerida
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={formData.prioridade || ''} onValueChange={(value) => setFormData({ ...formData, prioridade: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status Inicial</Label>
              <Select value={formData.status || ''} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aguardando Separação">Aguardando</SelectItem>
                  <SelectItem value="Em Separação">Em Separacao</SelectItem>
                  <SelectItem value="Pronto para Expedir">Pronto</SelectItem>
                  <SelectItem value="Saiu para Entrega">Saiu para Entrega</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Endereco de Entrega
          </h3>
          <BuscaCEP
            enderecoAtual={endereco}
            onEnderecoEncontrado={(dados) => setFormData({
              ...formData,
              endereco_entrega_completo: { ...endereco, ...dados },
            })}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <Label>Logradouro</Label>
              <Input value={endereco.logradouro || ''} onChange={(event) => setFormData({ ...formData, endereco_entrega_completo: { ...endereco, logradouro: event.target.value } })} />
            </div>
            <div>
              <Label>Numero</Label>
              <Input value={endereco.numero || ''} onChange={(event) => setFormData({ ...formData, endereco_entrega_completo: { ...endereco, numero: event.target.value } })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Bairro</Label><Input value={endereco.bairro || ''} onChange={(event) => setFormData({ ...formData, endereco_entrega_completo: { ...endereco, bairro: event.target.value } })} /></div>
            <div><Label>Cidade</Label><Input value={endereco.cidade || ''} onChange={(event) => setFormData({ ...formData, endereco_entrega_completo: { ...endereco, cidade: event.target.value } })} /></div>
            <div><Label>UF</Label><Input value={endereco.estado || ''} maxLength={2} onChange={(event) => setFormData({ ...formData, endereco_entrega_completo: { ...endereco, estado: event.target.value } })} /></div>
          </div>
          <div>
            <Label>Complemento / Referencia</Label>
            <Input value={endereco.complemento || ''} onChange={(event) => setFormData({ ...formData, endereco_entrega_completo: { ...endereco, complemento: event.target.value } })} placeholder="Apto, bloco, proximo a..." />
          </div>
          <Card className="bg-purple-50 border-purple-300">
            <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-900 font-medium">{endereco.link_google_maps ? 'Geolocalizacao configurada' : 'Gerar link Google Maps'}</span>
              </div>
              <Button type="button" onClick={onBuscarGeolocalizacao} disabled={!contextoValido || !canSaveEntrega} data-action="Entrega.geolocalizacao" data-permission={permission} data-context-required="true" data-sensitive="true" variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                <Zap className="w-4 h-4 mr-1" /> Gerar com IA
              </Button>
            </div>
          </Card>
          <label className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200 text-sm text-blue-900">
            <input type="checkbox" checked={Boolean(formData.salvar_endereco_no_cliente)} onChange={(event) => setFormData({ ...formData, salvar_endereco_no_cliente: event.target.checked })} />
            Salvar este endereco no cadastro do cliente
          </label>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center gap-2"><Phone className="w-5 h-5" /> Contato para Entrega</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nome do Contato</Label><Input value={contato.nome || ''} onChange={(event) => setFormData({ ...formData, contato_entrega: { ...contato, nome: event.target.value } })} placeholder="Quem vai receber" /></div>
            <div><Label>Telefone/WhatsApp</Label><Input value={contato.whatsapp || ''} onChange={(event) => setFormData({ ...formData, contato_entrega: { ...contato, whatsapp: event.target.value } })} placeholder="(11) 99999-9999" /></div>
          </div>
          <div><Label>Instrucoes Especiais</Label><Textarea value={contato.instrucoes_especiais || ''} onChange={(event) => setFormData({ ...formData, contato_entrega: { ...contato, instrucoes_especiais: event.target.value } })} rows={2} placeholder="Ligar antes, entregar na portaria..." /></div>
          <label className="flex items-center gap-2 p-3 bg-green-50 rounded border border-green-200 text-sm text-green-900">
            <input type="checkbox" checked={Boolean(formData.salvar_contato_no_cliente)} onChange={(event) => setFormData({ ...formData, salvar_contato_no_cliente: event.target.checked })} />
            Salvar este contato no cadastro do cliente
          </label>
        </section>

        <section className="space-y-4">
          <h3 className="font-semibold text-slate-900 border-b pb-2">Transporte</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Frete</Label>
              <Select value={formData.tipo_frete || ''} onValueChange={(value) => setFormData({ ...formData, tipo_frete: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CIF">CIF (Pagamos)</SelectItem><SelectItem value="FOB">FOB (Cliente Paga)</SelectItem><SelectItem value="Retira">Cliente Retira</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Transportadora</Label><Input value={formData.transportadora || ''} onChange={(event) => setFormData({ ...formData, transportadora: event.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Motorista</Label><Input value={formData.motorista || ''} onChange={(event) => setFormData({ ...formData, motorista: event.target.value })} /></div>
            <div><Label>Telefone Motorista</Label><Input value={formData.motorista_telefone || ''} onChange={(event) => setFormData({ ...formData, motorista_telefone: event.target.value })} /></div>
            <div><Label>Placa</Label><Input value={formData.placa || ''} onChange={(event) => setFormData({ ...formData, placa: event.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Volumes</Label><Input type="number" min="1" value={formData.volumes || 1} onChange={(event) => setFormData({ ...formData, volumes: parseInt(event.target.value, 10) || 1 })} /></div>
            <div><Label>Peso (kg)</Label><Input type="number" step="0.01" value={formData.peso_total_kg || 0} onChange={(event) => setFormData({ ...formData, peso_total_kg: parseFloat(event.target.value) || 0 })} /></div>
            <div><Label>Valor Frete</Label><Input type="number" step="0.01" value={formData.valor_frete || 0} onChange={(event) => setFormData({ ...formData, valor_frete: parseFloat(event.target.value) || 0 })} /></div>
          </div>
          <div><Label>Codigo de Rastreamento</Label><Input value={formData.codigo_rastreamento || ''} onChange={(event) => setFormData({ ...formData, codigo_rastreamento: event.target.value })} placeholder="Sera preenchido pela integracao com transportadora" /></div>
        </section>

        <div><Label>Observacoes Logisticas</Label><Textarea value={formData.observacoes || ''} onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })} rows={3} placeholder="Informacoes adicionais sobre a entrega..." /></div>

        {Number(formData.peso_total_kg || 0) > 1000 && (
          <Card className="bg-orange-50 border-orange-300"><div className="p-3 text-sm text-orange-800"><p className="font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Atencao: carga pesada</p><p className="text-xs mt-1">Verifique se o veiculo suporta {formData.peso_total_kg}kg. Considere reforco estrutural.</p></div></Card>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || !contextoValido || !canSaveEntrega} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" data-permission={permission} data-action={isEditing ? 'Entrega.atualizar' : 'Entrega.criar'} data-context-required="true" data-sensitive="true">
            <CheckCircle2 className="w-4 h-4 mr-2" /> {isEditing ? 'Atualizar' : 'Criar'} Entrega
          </Button>
        </div>
      </FormWrapper>
    </div>
  );

  return windowMode ? <div className="w-full h-full bg-white overflow-auto">{content}</div> : content;
}
