import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Mail, Plus, Edit, Trash2, Check, MessageCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * V21.1.2 - SUB-DIALOG MANTIDO (usado dentro de forms maiores)
 * Dialogs internos são permitidos quando fazem parte de um fluxo maior
 */
export default function GerenciarContatosClienteForm({ contatos = [], onChange }) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [contatoEditando, setContatoEditando] = useState(null);

  const [novoContato, setNovoContato] = useState({
    nome: "",
    cargo: "",
    tipo: "Telefone",
    valor: "",
    principal: false,
    observacao: ""
  });

  const resetForm = () => {
    setNovoContato({
      nome: "",
      cargo: "",
      tipo: "Telefone",
      valor: "",
      principal: false,
      observacao: ""
    });
    setContatoEditando(null);
  };

  const handleSalvarContato = () => {
    if (!novoContato.valor) {
      alert("Preencha o valor do contato");
      return;
    }

    const contatosAtualizados = [...contatos];

    if (contatoEditando !== null) {
      contatosAtualizados[contatoEditando] = novoContato;
    } else {
      contatosAtualizados.push(novoContato);
    }

    if (novoContato.principal) {
      contatosAtualizados.forEach((cont, idx) => {
        if (idx !== contatoEditando) {
          cont.principal = false;
        }
      });
    }

    onChange(contatosAtualizados);
    setDialogAberto(false);
    resetForm();
  };

  const handleEditarContato = (index) => {
    setContatoEditando(index);
    setNovoContato({ ...contatos[index] });
    setDialogAberto(true);
  };

  const handleExcluirContato = (index) => {
    const contatosAtualizados = contatos.filter((_, i) => i !== index);
    onChange(contatosAtualizados);
  };

  const getIcone = (tipo) => {
    switch(tipo) {
      case 'WhatsApp': return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'E-mail': return <Mail className="w-4 h-4 text-blue-600" />;
      case 'Telefone': return <Phone className="w-4 h-4 text-slate-600" />;
      case 'Celular': return <Phone className="w-4 h-4 text-sky-600" />;
      default: return <Phone className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contatos ({contatos.length})</h3>
        <Button onClick={() => { resetForm(); setDialogAberto(true); }} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Contato
        </Button>
      </div>

      {contatos.length > 0 ? (
        <div className="space-y-2">
          {contatos.map((contato, idx) => (
            <div 
              key={idx} 
              className="p-3 border rounded-lg hover:border-blue-500 transition-all bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getIcone(contato.tipo)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{contato.nome || 'Sem nome'}</p>
                      {contato.principal && <Badge className="bg-green-600 text-xs">Principal</Badge>}
                    </div>
                    {contato.cargo && (
                      <p className="text-xs text-slate-600">{contato.cargo}</p>
                    )}
                    <p className="text-sm text-slate-700 mt-1">{contato.valor}</p>
                    <Badge variant="outline" className="text-xs mt-1">{contato.tipo}</Badge>
                    {contato.observacao && (
                      <p className="text-xs text-slate-600 mt-1 italic">{contato.observacao}</p>
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
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
          <Phone className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhum contato cadastrado</p>
          <Button 
            onClick={() => { resetForm(); setDialogAberto(true); }}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Primeiro Contato
          </Button>
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle>
              {contatoEditando !== null ? 'Editar' : 'Novo'} Contato
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome do Contato</Label>
              <Input
                value={novoContato.nome}
                onChange={(e) => setNovoContato({ ...novoContato, nome: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <Label>Cargo / Departamento</Label>
              <Input
                value={novoContato.cargo}
                onChange={(e) => setNovoContato({ ...novoContato, cargo: e.target.value })}
                placeholder="Ex: Gerente de Compras"
              />
            </div>

            <div>
              <Label>Tipo de Contato *</Label>
              <Select
                value={novoContato.tipo || "Telefone"}
                onValueChange={(v) => setNovoContato({ ...novoContato, tipo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[10000]">
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
              <Label className="cursor-pointer font-normal">Marcar como contato principal</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setDialogAberto(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarContato}>
                <Check className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}