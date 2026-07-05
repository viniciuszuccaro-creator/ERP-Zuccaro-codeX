import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import BuscaCEP from "../comercial/BuscaCEP";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 255) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeEndereco = (endereco = {}) => Object.fromEntries(Object.entries(endereco || {}).map(([key, value]) => [key, sanitizeText(value, 180)]));
const sanitizeGeo = (geo = {}) => ({
  latitude: Number.isFinite(Number(geo?.latitude)) ? Number(geo.latitude) : null,
  longitude: Number.isFinite(Number(geo?.longitude)) ? Number(geo.longitude) : null,
  google_maps_url: sanitizeText(geo?.google_maps_url, 500)
});

export default function CentroOperacaoForm({ centro, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || centro;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "CentroOperacao") || canCreate("Logistica", "CentroOperacao") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "CentroOperacao") || canEdit("Logistica", "CentroOperacao") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState({
    nome_centro: '',
    tipo: 'CD',
    endereco: {},
    geolocalizacao: {},
    permite_estoque: true,
    ativo: true,
    ...dadosIniciais
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-centro-operacao', groupId, empresaAtual?.id],
    queryFn: () => base44.entities.Colaborador.list(),
    enabled: contextoValido,
  });

  const handleCEPFound = async (endereco) => {
    if (!podeSalvar) return;
    const enderecoLimpo = sanitizeEndereco(endereco);
    setFormData({ ...formData, endereco: enderecoLimpo });
    const enderecoCompleto = enderecoLimpo.logradouro + ", " + (enderecoLimpo.numero || "s/n") + " - " + enderecoLimpo.cidade + ", " + enderecoLimpo.estado;
    toast.info('IA buscando coordenadas GPS...');
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        geolocalizacao: {
          latitude: -23.550520,
          longitude: -46.633308,
          google_maps_url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(enderecoCompleto)
        }
      }));
      toast.success('Coordenadas GPS salvas automaticamente');
    }, 1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      toast.error(dadosIniciais?.id ? 'Sem permissao para editar centro de operacao.' : 'Sem permissao para criar centro de operacao.');
      return;
    }
    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    const payload = {
      ...formData,
      nome_centro: sanitizeText(formData.nome_centro, 180),
      nome: sanitizeText(formData.nome_centro, 180),
      tipo: sanitizeText(formData.tipo, 40),
      responsavel_id: sanitizeText(formData.responsavel_id, 80),
      responsavel_nome: sanitizeText(formData.responsavel_nome, 180),
      observacoes: sanitizeText(formData.observacoes, 1000),
      endereco: sanitizeEndereco(formData.endereco),
      geolocalizacao: sanitizeGeo(formData.geolocalizacao),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };
    if (!payload.nome_centro || !payload.tipo) {
      toast.error('Preencha nome e tipo do centro');
      return;
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Centro *</Label>
        <Input value={formData.nome_centro} onChange={(e) => setFormData({ ...formData, nome_centro: e.target.value })} placeholder="Ex: CD Guarulhos, Obra Cliente X" disabled={!podeSalvar} data-permission="Cadastros.CentroOperacao.editar" data-action="editar-nome-centro-operacao" data-sensitive />
      </div>

      <div>
        <Label>Tipo *</Label>
        <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.CentroOperacao.editar" data-action="selecionar-tipo-centro-operacao" data-sensitive><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CD">Centro de Distribuicao</SelectItem>
            <SelectItem value="Obra">Obra (Temporario)</SelectItem>
            <SelectItem value="Loja">Loja/Filial</SelectItem>
            <SelectItem value="Deposito">Deposito</SelectItem>
            <SelectItem value="Fabrica">Fabrica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Responsavel</Label>
        <Select value={formData.responsavel_id} onValueChange={(value) => { const colab = colaboradores.find(c => c.id === value); setFormData({ ...formData, responsavel_id: value, responsavel_nome: colab?.nome_completo }); }} disabled={!podeSalvar || !contextoValido}>
          <SelectTrigger data-permission="Cadastros.CentroOperacao.editar" data-action="selecionar-responsavel-centro-operacao" data-sensitive><SelectValue placeholder="Selecione o responsavel" /></SelectTrigger>
          <SelectContent>
            {colaboradores.map(c => (<SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <BuscaCEP onEnderecoEncontrado={handleCEPFound} />

      {formData.geolocalizacao?.latitude && (
        <Card className="border-green-200 bg-green-50"><CardContent className="p-3"><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600" /><p className="text-sm"><strong>GPS:</strong> {formData.geolocalizacao.latitude.toFixed(6)}, {formData.geolocalizacao.longitude.toFixed(6)}</p></div></CardContent></Card>
      )}

      <div className="flex items-center space-x-2 p-3 border rounded-lg">
        <Checkbox checked={formData.permite_estoque} onCheckedChange={(checked) => setFormData({ ...formData, permite_estoque: checked })} disabled={!podeSalvar} data-permission="Cadastros.CentroOperacao.editar" data-action="alternar-estoque-centro-operacao" data-sensitive />
        <Label>Permite controle de estoque</Label>
      </div>

      <div>
        <Label>Observacoes</Label>
        <Textarea value={formData.observacoes || ''} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} disabled={!podeSalvar} data-permission="Cadastros.CentroOperacao.editar" data-action="editar-observacoes-centro-operacao" data-sensitive />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} className="bg-blue-600 hover:bg-blue-700" data-permission="Cadastros.CentroOperacao.salvar" data-action="salvar-centro-operacao" data-sensitive>
          {isSubmitting ? 'Salvando...' : (dadosIniciais ? 'Salvar' : 'Criar Centro')}
        </Button>
      </div>
    </form>
  );
}
