import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, Edit, Trash2, Check, ExternalLink, Route } from "lucide-react";
import BuscaCEP from "@/components/comercial/BuscaCEP";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - SUB-DIALOG MANTIDO (usado dentro de forms maiores)
 * Dialogs internos são permitidos quando fazem parte de um fluxo maior.
 * Pacote D (#431+): mesmo contrato Contatos — RBAC + assertScope + persistBusy;
 * onChange assíncrono (falha mantém diálogo; sem double-close).
 */
export default function GerenciarEnderecosClienteForm({
  enderecos = [],
  onChange,
  assertScopeCurrent,
  persistBusy = false,
}) {
  const { canEdit } = usePermissions();
  const podeEditar = canEdit("Cadastros", "Cliente") || canEdit("Cadastros", null);
  const assertScope = () => {
    if (typeof assertScopeCurrent !== "function") return;
    assertScopeCurrent();
  };
  const [dialogAberto, setDialogAberto] = useState(false);
  const [enderecoEditando, setEnderecoEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const bloqueado = Boolean(persistBusy || salvando);

  const [novoEndereco, setNovoEndereco] = useState({
    apelido: "",
    tipo_endereco: "Entrega",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    latitude: null,
    longitude: null,
    mapa_url: "",
    horario_inicio: "",
    horario_fim: "",
    contato_nome: "",
    contato_telefone: "",
    observacoes: "",
    principal: false
  });

  const resetForm = () => {
    setNovoEndereco({
      apelido: "",
      tipo_endereco: "Entrega",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      latitude: null,
      longitude: null,
      mapa_url: "",
      horario_inicio: "",
      horario_fim: "",
      contato_nome: "",
      contato_telefone: "",
      observacoes: "",
      principal: false
    });
    setEnderecoEditando(null);
  };

  const abrirNovo = () => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar endereços do cliente.");
      return;
    }
    if (bloqueado) {
      toast.error("Aguarde a gravação de endereços em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    resetForm();
    setDialogAberto(true);
  };

  const handleSalvarEndereco = async () => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar endereços do cliente.");
      return;
    }
    if (bloqueado) {
      toast.error("Aguarde a gravação de endereços em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    if (!novoEndereco.logradouro || !novoEndereco.numero) {
      toast.error("Preencha logradouro e número");
      return;
    }

    // Gerar URL do Google Maps se tiver coordenadas ou CEP
    let mapaUrl = novoEndereco.mapa_url;
    if (!mapaUrl) {
      if (novoEndereco.latitude && novoEndereco.longitude) {
        mapaUrl = `https://www.google.com/maps?q=${novoEndereco.latitude},${novoEndereco.longitude}`;
      } else if (novoEndereco.cep) {
        mapaUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${novoEndereco.logradouro}, ${novoEndereco.numero}, ${novoEndereco.bairro}, ${novoEndereco.cidade}, ${novoEndereco.estado}, ${novoEndereco.cep}`
        )}`;
      }
    }

    const enderecosAtualizados = [...enderecos];
    const enderecoComMapa = { ...novoEndereco, mapa_url: mapaUrl };

    if (enderecoEditando !== null) {
      enderecosAtualizados[enderecoEditando] = enderecoComMapa;
    } else {
      enderecosAtualizados.push(enderecoComMapa);
    }

    if (novoEndereco.principal) {
      enderecosAtualizados.forEach((end, idx) => {
        if (idx !== enderecoEditando) {
          end.principal = false;
        }
      });
    }

    setSalvando(true);
    try {
      await Promise.resolve(onChange(enderecosAtualizados));
      setDialogAberto(false);
      resetForm();
    } catch (error) {
      // Mantém diálogo/rascunho; comunica falha (Codex P1 — não engolir).
      toast.error(error?.message || "Falha ao salvar endereço.");
    } finally {
      setSalvando(false);
    }
  };

  const handleEditarEndereco = (index) => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar endereços do cliente.");
      return;
    }
    if (bloqueado) {
      toast.error("Aguarde a gravação de endereços em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    setEnderecoEditando(index);
    setNovoEndereco({ ...enderecos[index] });
    setDialogAberto(true);
  };

  const handleExcluirEndereco = async (index) => {
    if (!podeEditar) {
      toast.error("Sem permissão para editar endereços do cliente.");
      return;
    }
    if (bloqueado) {
      toast.error("Aguarde a gravação de endereços em andamento.");
      return;
    }
    try { assertScope(); } catch (error) {
      toast.error(error?.message || "Contexto alterado. Reabra o cadastro.");
      return;
    }
    const enderecosAtualizados = enderecos.filter((_, i) => i !== index);
    setSalvando(true);
    try {
      await Promise.resolve(onChange(enderecosAtualizados));
    } catch (error) {
      toast.error(error?.message || "Falha ao excluir endereço.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Endereços de Entrega ({enderecos.length})</h3>
        <Button
          onClick={abrirNovo}
          size="sm"
          disabled={bloqueado || !podeEditar}
          data-permission="Cadastros.Cliente.editar"
          data-action="Cadastros.Cliente.endereco.adicionar"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Endereço
        </Button>
      </div>

      {enderecos.length > 0 ? (
        <div className="space-y-2">
          {enderecos.map((endereco, idx) => (
            <div 
              key={idx} 
              className="p-3 border rounded-lg hover:border-blue-500 transition-all bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <p className="font-semibold">{endereco.apelido || `Endereço ${idx + 1}`}</p>
                    {endereco.principal && <Badge className="bg-green-600 text-xs">Principal</Badge>}
                    <Badge variant="outline" className="text-xs">{endereco.tipo_endereco || 'Entrega'}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">
                    {endereco.logradouro}, {endereco.numero}
                    {endereco.complemento && ` - ${endereco.complemento}`}
                  </p>
                  <p className="text-sm text-slate-600">
                    {endereco.bairro} - {endereco.cidade}/{endereco.estado}
                    {endereco.cep && ` - CEP: ${endereco.cep}`}
                  </p>
                  {endereco.contato_nome && (
                    <p className="text-xs text-slate-500 mt-1">
                      Contato: {endereco.contato_nome} {endereco.contato_telefone && `- ${endereco.contato_telefone}`}
                    </p>
                  )}
                  {endereco.horario_inicio && endereco.horario_fim && (
                    <p className="text-xs text-slate-500 mt-1">
                      Horário: {endereco.horario_inicio} às {endereco.horario_fim}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {endereco.mapa_url && (
                      <a 
                        href={endereco.mapa_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver no Google Maps
                      </a>
                    )}
                    {endereco.latitude && endereco.longitude && (
                      <Link
                        to={createPageUrl('Expedicao') + '?tab=rotas'}
                        className="text-xs text-green-600 hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Route className="w-3 h-3" />
                        Roteirizar
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditarEndereco(idx)}
                    disabled={bloqueado || !podeEditar}
                    data-permission="Cadastros.Cliente.editar"
                    data-action="Cadastros.Cliente.endereco.editar"
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleExcluirEndereco(idx)}
                    disabled={bloqueado || !podeEditar}
                    data-permission="Cadastros.Cliente.editar"
                    data-action="Cadastros.Cliente.endereco.excluir"
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
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhum endereço cadastrado</p>
          <Button 
            onClick={abrirNovo}
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={bloqueado || !podeEditar}
            data-permission="Cadastros.Cliente.editar"
            data-action="Cadastros.Cliente.endereco.adicionar"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Primeiro Endereço
          </Button>
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[9999]">
          <DialogHeader>
            <DialogTitle>
              {enderecoEditando !== null ? 'Editar' : 'Novo'} Endereço
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Apelido do Endereço *</Label>
                <Input
                  value={novoEndereco.apelido}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, apelido: e.target.value })}
                  placeholder="Ex: Matriz, Filial Centro, Obra SP"
                />
              </div>

              <div>
                <Label>Tipo de Endereço</Label>
                <Select
                  value={novoEndereco.tipo_endereco || "Entrega"}
                  onValueChange={(value) => setNovoEndereco({ ...novoEndereco, tipo_endereco: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="Entrega">Entrega</SelectItem>
                    <SelectItem value="Cobrança">Cobrança</SelectItem>
                    <SelectItem value="Matriz">Matriz</SelectItem>
                    <SelectItem value="Obra">Obra</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <BuscaCEP
              enderecoAtual={novoEndereco}
              onEnderecoEncontrado={(endereco) => {
                setNovoEndereco({
                  ...novoEndereco,
                  cep: endereco.cep || novoEndereco.cep,
                  logradouro: endereco.logradouro || novoEndereco.logradouro,
                  bairro: endereco.bairro || novoEndereco.bairro,
                  cidade: endereco.cidade || novoEndereco.cidade,
                  estado: endereco.estado || novoEndereco.estado,
                  complemento: endereco.complemento || novoEndereco.complemento,
                  latitude: endereco.latitude !== undefined ? endereco.latitude : novoEndereco.latitude,
                  longitude: endereco.longitude !== undefined ? endereco.longitude : novoEndereco.longitude,
                  mapa_url: endereco.mapa_url || novoEndereco.mapa_url
                });
              }}
            />

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <Label>Logradouro *</Label>
                <Input
                  value={novoEndereco.logradouro}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, logradouro: e.target.value })}
                />
              </div>
              <div>
                <Label>Número *</Label>
                <Input
                  value={novoEndereco.numero}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, numero: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Bairro</Label>
                <Input
                  value={novoEndereco.bairro}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, bairro: e.target.value })}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={novoEndereco.cidade}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, cidade: e.target.value })}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={novoEndereco.estado}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, estado: e.target.value })}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
            </div>

            <div>
              <Label>Complemento</Label>
              <Input
                value={novoEndereco.complemento}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, complemento: e.target.value })}
                placeholder="Apto, Sala, Bloco..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude (GPS)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={novoEndereco.latitude || ""}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, latitude: parseFloat(e.target.value) || null })}
                  placeholder="-23.550520"
                />
              </div>
              <div>
                <Label>Longitude (GPS)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={novoEndereco.longitude || ""}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, longitude: parseFloat(e.target.value) || null })}
                  placeholder="-46.633308"
                />
              </div>
            </div>

            <div>
              <Label>Link do Google Maps 🗺️</Label>
              <Input
                value={novoEndereco.mapa_url}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, mapa_url: e.target.value })}
                placeholder="https://www.google.com/maps/..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Cole o link direto do Google Maps ou deixe em branco para gerar automaticamente
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Horário Início Recebimento</Label>
                <Input
                  type="time"
                  value={novoEndereco.horario_inicio}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, horario_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Horário Fim Recebimento</Label>
                <Input
                  type="time"
                  value={novoEndereco.horario_fim}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, horario_fim: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contato no Local</Label>
                <Input
                  value={novoEndereco.contato_nome}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, contato_nome: e.target.value })}
                  placeholder="Nome de quem recebe"
                />
              </div>
              <div>
                <Label>Telefone do Contato</Label>
                <Input
                  value={novoEndereco.contato_telefone}
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, contato_telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={novoEndereco.observacoes}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, observacoes: e.target.value })}
                placeholder="Instruções especiais de entrega..."
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-green-50 rounded border">
              <input
                type="checkbox"
                checked={novoEndereco.principal}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, principal: e.target.checked })}
                className="w-4 h-4"
              />
              <Label className="cursor-pointer font-normal">Marcar como endereço principal</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setDialogAberto(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSalvarEndereco}
                disabled={bloqueado || !podeEditar}
                data-permission="Cadastros.Cliente.editar"
                data-action="Cadastros.Cliente.endereco.salvar"
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