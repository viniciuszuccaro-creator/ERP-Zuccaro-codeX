import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Mail, Plus, Edit, Trash2, Check, MessageCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - SUB-DIALOG MANTIDO (usado dentro de forms maiores)
 * Dialogs internos são permitidos quando fazem parte de um fluxo maior
 * Lacuna vs erp-integra-novo: botões de mutação sem RBAC fail-closed.
 * Trava síncrona (ref) além de setSalvando: duplo clique antes do re-render
 * não dispara onChange duas vezes (mesmo contrato Endereços / Codex #432).
 */
export default function GerenciarContatosClienteForm({ contatos = [], onChange, assertScopeCurrent, persistBusy = false }) {
  const { canEdit } = usePermissions();
  const podeEditar = canEdit("Cadastros", "Cliente") || canEdit("Cadastros", null);
  const assertScope = () => {
    if (typeof assertScopeCurrent !== "function") return;
    assertScopeCurrent();
  };
  const [dialogAberto, setDialogAberto] = useState(false);
  const [contatoEditando, setContatoEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  /** Sync lock — setState só re-renderiza depois; ref bloqueia o 2º clique no mesmo tick. */
  const persistInFlightRef = useRef(false);
  const bloqueado = Boolean(persistBusy || salvando || persistInFlightRef.current);

  const beginPersist = () => {
    if (persistInFlightRef.current) return false;
    persistInFlightRef.current = true;
    setSalvando(true);
    return true;
  };
  const endPersist = () => {
    persistInFlightRef.current = false;
    setSalvando(false);
  };

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

  const abrirNovo = () => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar contatos do cliente.");
      return;
    }
    if (bloqueado || persistInFlightRef.current) {
      toast.error("Aguarde a gravação de contatos em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    resetForm();
    setDialogAberto(true);
  };

  const handleSalvarContato = async () => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar contatos do cliente.");
      return;
    }
    if (bloqueado || persistInFlightRef.current) {
      toast.error("Aguarde a gravação de contatos em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    if (!novoContato.valor) {
      toast.error("Preencha o valor do contato");
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

    if (!beginPersist()) {
      toast.error("Aguarde a gravação de contatos em andamento.");
      return;
    }
    try {
      await Promise.resolve(onChange(contatosAtualizados));
      setDialogAberto(false);
      resetForm();
    } catch (error) {
      // Mantém diálogo/rascunho; comunica falha (não engolir — AGENTS § persistência).
      toast.error(error?.message || "Falha ao salvar contatos.");
    } finally {
      endPersist();
    }
  };

  const handleEditarContato = (index) => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar contatos do cliente.");
      return;
    }
    if (bloqueado || persistInFlightRef.current) {
      toast.error("Aguarde a gravação de contatos em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    setContatoEditando(index);
    setNovoContato({ ...contatos[index] });
    setDialogAberto(true);
  };

  const handleExcluirContato = async (index) => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar contatos do cliente.");
      return;
    }
    if (bloqueado || persistInFlightRef.current) {
      toast.error("Aguarde a gravação de contatos em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    const contatosAtualizados = contatos.filter((_, i) => i !== index);
    if (!beginPersist()) {
      toast.error("Aguarde a gravação de contatos em andamento.");
      return;
    }
    try {
      await Promise.resolve(onChange(contatosAtualizados));
    } catch (error) {
      toast.error(error?.message || "Falha ao excluir contato.");
    } finally {
      endPersist();
    }
  };

  const getIcone = (tipo) => {
    switch(tipo) {
      case 'WhatsApp': return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'E-mail': return <Mail className="w-4 h-4 text-sky-600" />;
      case 'Telefone': return <Phone className="w-4 h-4 text-slate-600" />;
      case 'Celular': return <Phone className="w-4 h-4 text-sky-600" />;
      default: return <Phone className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contatos ({contatos.length})</h3>
        <Button
          onClick={abrirNovo}
          size="sm"
          disabled={bloqueado || !podeEditar}
          data-permission="Cadastros.Cliente.editar"
          data-action="Cadastros.Cliente.contato.adicionar"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Contato
        </Button>
      </div>

      {contatos.length > 0 ? (
        <div className="space-y-2">
          {contatos.map((contato, idx) => (
            <div 
              key={idx} 
              className="p-3 border rounded-lg hover:border-sky-500 transition-all bg-white"
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
                    disabled={!podeEditar}
                    data-permission="Cadastros.Cliente.editar"
                    data-action="Cadastros.Cliente.contato.editar"
                  >
                    <Edit className="w-4 h-4 text-sky-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleExcluirContato(idx)}
                    disabled={!podeEditar}
                    data-permission="Cadastros.Cliente.editar"
                    data-action="Cadastros.Cliente.contato.excluir"
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
            onClick={abrirNovo}
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={!podeEditar}
            data-permission="Cadastros.Cliente.editar"
            data-action="Cadastros.Cliente.contato.adicionar"
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
                disabled={!podeEditar}
              />
            </div>

            <div>
              <Label>Cargo / Departamento</Label>
              <Input
                value={novoContato.cargo}
                onChange={(e) => setNovoContato({ ...novoContato, cargo: e.target.value })}
                placeholder="Ex: Gerente de Compras"
                disabled={!podeEditar}
              />
            </div>

            <div>
              <Label>Tipo de Contato *</Label>
              <Select
                value={novoContato.tipo || "Telefone"}
                onValueChange={(v) => setNovoContato({ ...novoContato, tipo: v })}
                disabled={!podeEditar}
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
                disabled={!podeEditar}
              />
            </div>

            <div>
              <Label>Observação</Label>
              <Input
                value={novoContato.observacao}
                onChange={(e) => setNovoContato({ ...novoContato, observacao: e.target.value })}
                placeholder="Ex: Ligar somente após 14h"
                disabled={!podeEditar}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-green-50 rounded border">
              <input
                type="checkbox"
                checked={novoContato.principal}
                onChange={(e) => setNovoContato({ ...novoContato, principal: e.target.checked })}
                className="w-4 h-4"
                disabled={!podeEditar}
              />
              <Label className="cursor-pointer font-normal">Marcar como contato principal</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setDialogAberto(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSalvarContato}
                disabled={!podeEditar}
                data-permission="Cadastros.Cliente.editar"
                data-action="Cadastros.Cliente.contato.salvar"
              >
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
