/**
 * Pacote E — keep both (2026-10-29):
 * Capacidade de edição de contatos do Cliente. Consumidor canônico atual:
 * `cadastros/GerenciarContatosClienteForm.jsx` (RBAC Cadastros.Cliente + assertScope).
 * Este arquivo NÃO tem import in-repo (Painel/Cadastro usam o Form). Não apagar
 * sem inventário + aceite do usuário (Regra-Mãe §3/§1). Sem 3º módulo.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Mail, Plus, Edit, Trash2, Check, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GerenciarContatosCliente({ clienteId }) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [contatoEditando, setContatoEditando] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [novoContato, setNovoContato] = useState({
    nome: "",
    tipo: "Telefone",
    valor: "",
    principal: false,
    observacao: ""
  });

  const { data: cliente } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const clientes = await base44.entities.Cliente.filter({ id: clienteId });
      return clientes[0] || null;
    },
    enabled: !!clienteId
  });

  const updateClienteMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Cliente.update(clienteId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: "✅ Contatos Atualizados!" });
      setDialogAberto(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setNovoContato({
      nome: "",
      tipo: "Telefone",
      valor: "",
      principal: false,
      observacao: ""
    });
    setContatoEditando(null);
  };

  const handleSalvarContato = () => {
    if (!novoContato.nome || !novoContato.valor) {
      toast({ 
        title: "❌ Erro", 
        description: "Preencha nome e valor do contato", 
        variant: "destructive" 
      });
      return;
    }

    const contatosAtualizados = [...(cliente?.contatos || [])];

    if (contatoEditando !== null) {
      // Editando
      contatosAtualizados[contatoEditando] = novoContato;
    } else {
      // Adicionando
      contatosAtualizados.push(novoContato);
    }

    // Se marcar como principal, remove principal dos outros
    if (novoContato.principal) {
      contatosAtualizados.forEach((cont, idx) => {
        if (idx !== contatoEditando) {
          cont.principal = false;
        }
      });
    }

    updateClienteMutation.mutate({ contatos: contatosAtualizados });
  };

  const handleEditarContato = (index) => {
    setContatoEditando(index);
    setNovoContato({ ...(cliente?.contatos[index]) });
    setDialogAberto(true);
  };

  const handleExcluirContato = (index) => {
    const contatosAtualizados = (cliente?.contatos || []).filter((_, i) => i !== index);
    updateClienteMutation.mutate({ contatos: contatosAtualizados });
  };

  if (!clienteId) return null;

  const contatos = cliente?.contatos || [];

  const getIcone = (tipo) => {
    switch(tipo) {
      case 'WhatsApp': return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'E-mail': return <Mail className="w-4 h-4 text-blue-600" />;
      case 'Telefone': return <Phone className="w-4 h-4 text-slate-600" />;
      case 'Celular': return <Phone className="w-4 h-4 text-purple-600" />;
      default: return <Phone className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Contatos ({contatos.length})</CardTitle>
        <Button onClick={() => { resetForm(); setDialogAberto(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Contato
        </Button>
      </CardHeader>
      <CardContent>
        {contatos.length > 0 ? (
          <div className="space-y-2">
            {contatos.map((contato, idx) => (
              <div 
                key={idx} 
                className="p-3 border rounded hover:border-blue-500 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {getIcone(contato.tipo)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{contato.nome || 'Sem nome'}</p>
                        {contato.principal && <Badge className="bg-green-600">Principal</Badge>}
                      </div>
                      <p className="text-sm text-slate-700">{contato.valor}</p>
                      <p className="text-xs text-slate-500">{contato.tipo}</p>
                      {contato.observacao && (
                        <p className="text-xs text-slate-600 mt-1">{contato.observacao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditarContato(idx)}
                    >
                      <Edit className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExcluirContato(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-6">
            Nenhum contato cadastrado. Clique em "Novo Contato" para adicionar.
          </p>
        )}
      </CardContent>

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {contatoEditando !== null ? 'Editar' : 'Novo'} Contato
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome do Contato *</Label>
              <Input
                value={novoContato.nome}
                onChange={(e) => setNovoContato({ ...novoContato, nome: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <Label>Tipo de Contato *</Label>
              <Select
                value={novoContato.tipo}
                onValueChange={(v) => setNovoContato({ ...novoContato, tipo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Celular">Celular</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor (Telefone/E-mail) *</Label>
              <Input
                value={novoContato.valor}
                onChange={(e) => setNovoContato({ ...novoContato, valor: e.target.value })}
                placeholder={novoContato.tipo === 'E-mail' ? 'email@exemplo.com' : '(11) 99999-9999'}
              />
            </div>

            <div>
              <Label>Observação</Label>
              <Input
                value={novoContato.observacao}
                onChange={(e) => setNovoContato({ ...novoContato, observacao: e.target.value })}
                placeholder="Ex: Ligar somente após 14h"
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-green-50 rounded border">
              <input
                type="checkbox"
                checked={novoContato.principal}
                onChange={(e) => setNovoContato({ ...novoContato, principal: e.target.checked })}
                className="w-4 h-4"
              />
              <Label className="cursor-pointer">Marcar como contato principal</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarContato} disabled={updateClienteMutation.isPending}>
                <Check className="w-4 h-4 mr-2" />
                {updateClienteMutation.isPending ? 'Salvando...' : 'Salvar Contato'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}