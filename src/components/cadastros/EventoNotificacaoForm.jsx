import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function EventoNotificacaoForm({ evento, onSubmit, isSubmitting, windowMode = false }) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || evento?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || evento?.empresa_id);
  const podeCriar = canCreate("Cadastros", "EventoNotificacao") || canCreate("Sistema", "EventoNotificacao") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "EventoNotificacao") || canEdit("Sistema", "EventoNotificacao") || canEdit("Cadastros", null);
  const podeSalvar = evento?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(evento || {
    nome_evento: "",
    tipo_evento: "Sistema",
    descricao: "",
    template_mensagem: "",
    canais_notificacao: ["Email"],
    prioridade: "Media",
    usuarios_destinatarios: [],
    ativo: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_evento) {
      alert('Nome do evento é obrigatório');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar eventos/notificacoes.');
      return;
    }
    await onSubmit({
      ...formData,
      nome: formData.nome_evento,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            Configuração de Evento/Notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Evento *</Label>
              <Input
                value={formData.nome_evento}
                onChange={(e) => setFormData({ ...formData, nome_evento: e.target.value })}
                placeholder="Ex: Pedido Aprovado"
                disabled={!podeSalvar}
                data-permission="Cadastros.EventoNotificacao.editar"
                data-action="editar-nome-evento-notificacao"
                data-sensitive
              />
            </div>
            <div>
              <Label>Tipo de Evento</Label>
              <Select value={formData.tipo_evento} onValueChange={(val) => setFormData({ ...formData, tipo_evento: val })} disabled={!podeSalvar}>
                <SelectTrigger data-permission="Cadastros.EventoNotificacao.editar" data-action="editar-tipo-evento-notificacao" data-sensitive>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sistema">Sistema</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Financeiro">Financeiro</SelectItem>
                  <SelectItem value="Logística">Logística</SelectItem>
                  <SelectItem value="Produção">Produção</SelectItem>
                  <SelectItem value="RH">RH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva quando este evento ocorre"
              rows={2}
              disabled={!podeSalvar}
              data-permission="Cadastros.EventoNotificacao.editar"
              data-action="editar-descricao-evento-notificacao"
            />
          </div>

          <div>
            <Label>Template da Mensagem</Label>
            <Textarea
              value={formData.template_mensagem}
              onChange={(e) => setFormData({ ...formData, template_mensagem: e.target.value })}
              placeholder="Use {variavel} para campos dinâmicos. Ex: Olá {cliente_nome}, seu pedido {numero_pedido} foi aprovado!"
              rows={4}
              disabled={!podeSalvar}
              data-permission="Cadastros.EventoNotificacao.editar"
              data-action="editar-template-evento-notificacao"
              data-sensitive
            />
          </div>

          <div>
            <Label>Prioridade</Label>
            <Select value={formData.prioridade} onValueChange={(val) => setFormData({ ...formData, prioridade: val })} disabled={!podeSalvar}>
              <SelectTrigger data-permission="Cadastros.EventoNotificacao.editar" data-action="editar-prioridade-evento-notificacao" data-sensitive>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Media">Média</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>Notificação Ativa</Label>
            <Switch
              checked={formData.ativo}
              onCheckedChange={(val) => setFormData({ ...formData, ativo: val })}
              disabled={!podeSalvar}
              data-permission="Cadastros.EventoNotificacao.editar"
              data-action="alternar-evento-notificacao"
              data-sensitive
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.EventoNotificacao.salvar" data-action="salvar-evento-notificacao" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : evento ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <Bell className="w-8 h-8 text-amber-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {evento ? 'Editar Evento/Notificação' : 'Novo Evento/Notificação'}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
