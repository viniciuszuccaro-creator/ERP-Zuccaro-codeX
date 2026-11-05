import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Plus, CheckCircle } from "lucide-react";
import BuscaCEP from "../comercial/BuscaCEP";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  isSeletorEnderecoScopeCurrent,
  assertSeletorEnderecoContext,
  assertSeletorEnderecoClienteId,
  buildSeletorEnderecoLocais,
} from "./seletorEnderecoEntregaScope";

/**
 * Seletor de Endereço de Entrega
 * Permite escolher endereço cadastrado ou criar novo.
 * Persistência no Cliente via updateInContext (não entities.update unscoped).
 */
export default function SeletorEnderecoEntrega({ cliente, onEnderecoSelecionado }) {
  const [modo, setModo] = useState("selecionar"); // selecionar | novo
  const [enderecoSelecionado, setEnderecoSelecionado] = useState(null);
  const [salvarNoCliente, setSalvarNoCliente] = useState(false);
  const queryClient = useQueryClient();
  const { updateInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;

  const readActorAndSession = () => {
    const session = readErpHttpSession();
    const actorId = typeof session?.actorId === "string" && session.actorId.trim()
      ? session.actorId.trim()
      : null;
    return { actorId, sessionKey: central360SessionKey(session?.token) };
  };

  const [novoEndereco, setNovoEndereco] = useState({
    apelido: "Endereço de Entrega",
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
    principal: false
  });

  const salvarEnderecoMutation = useMutation({
    mutationFn: async () => {
      if (salvarNoCliente) {
        assertSeletorEnderecoContext(groupId, empresaId);
        const clienteId = assertSeletorEnderecoClienteId(cliente);
        const scopeExpected = readActorAndSession();
        const novosLocais = buildSeletorEnderecoLocais(cliente, novoEndereco);
        await updateInContext("Cliente", clienteId, {
          locais_entrega: novosLocais,
        });
        if (!isSeletorEnderecoScopeCurrent(scopeExpected, readActorAndSession())) {
          throw Object.assign(new Error("SELETOR_ENDERECO_STALE_SCOPE"), {
            code: "SELETOR_ENDERECO_STALE_SCOPE",
          });
        }
      }
      return novoEndereco;
    },
    onSuccess: (endereco) => {
      queryClient.invalidateQueries({
        queryKey: ["clientes", groupId, empresaId],
      });
      onEnderecoSelecionado(endereco, salvarNoCliente);
    },
  });

  const handleConfirmar = () => {
    if (modo === "selecionar" && enderecoSelecionado) {
      onEnderecoSelecionado(enderecoSelecionado, false);
    } else if (modo === "novo") {
      if (!novoEndereco.cep || !novoEndereco.logradouro) {
        alert("Preencha CEP e Logradouro");
        return;
      }
      salvarEnderecoMutation.mutate();
    }
  };

  const enderecosDisponiveis = cliente?.locais_entrega || [];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-3 border-b pb-3">
        <Button
          variant={modo === "selecionar" ? "default" : "outline"}
          onClick={() => setModo("selecionar")}
          className="flex-1"
        >
          Endereços Cadastrados
        </Button>
        <Button
          variant={modo === "novo" ? "default" : "outline"}
          onClick={() => setModo("novo")}
          className="flex-1"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Endereço
        </Button>
      </div>

      {/* MODO: Selecionar */}
      {modo === "selecionar" && (
        <div className="space-y-3">
          {enderecosDisponiveis.length > 0 ? (
            enderecosDisponiveis.map((endereco, idx) => (
              <Card
                key={idx}
                className={`cursor-pointer transition-all ${
                  enderecoSelecionado === endereco 
                    ? 'border-2 border-blue-500 bg-blue-50' 
                    : 'hover:border-blue-300'
                }`}
                onClick={() => setEnderecoSelecionado(endereco)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {endereco.apelido || "Endereço"}
                          {endereco.principal && (
                            <Badge className="ml-2 bg-green-600">Principal</Badge>
                          )}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">
                          {endereco.logradouro}, {endereco.numero}
                          {endereco.complemento && ` - ${endereco.complemento}`}
                        </p>
                        <p className="text-sm text-slate-600">
                          {endereco.bairro} - {endereco.cidade}/{endereco.estado}
                        </p>
                        <p className="text-xs text-slate-500">CEP: {endereco.cep}</p>
                      </div>
                    </div>
                    {enderecoSelecionado === endereco && (
                      <CheckCircle className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-slate-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum endereço cadastrado</p>
                <p className="text-sm mt-1">Clique em "Novo Endereço" para adicionar</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* MODO: Novo */}
      {modo === "novo" && (
        <div className="space-y-4">
          <div>
            <Label>Apelido do Endereço</Label>
            <Input
              value={novoEndereco.apelido}
              onChange={(e) => setNovoEndereco({ ...novoEndereco, apelido: e.target.value })}
              placeholder="Ex: Obra Centro, Depósito Sul"
              className="mt-2"
            />
          </div>

          <BuscaCEP
            value={novoEndereco.cep}
            onCEPFound={(dados) => setNovoEndereco({
              ...novoEndereco,
              cep: dados.cep,
              logradouro: dados.logradouro,
              bairro: dados.bairro,
              cidade: dados.cidade,
              estado: dados.uf
            })}
          />

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <Label>Logradouro *</Label>
              <Input
                value={novoEndereco.logradouro}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, logradouro: e.target.value })}
                required
                className="mt-2"
              />
            </div>
            <div>
              <Label>Número *</Label>
              <Input
                value={novoEndereco.numero}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, numero: e.target.value })}
                required
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Bairro</Label>
              <Input
                value={novoEndereco.bairro}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, bairro: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={novoEndereco.cidade}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, cidade: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                value={novoEndereco.estado}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, estado: e.target.value })}
                maxLength={2}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Complemento / Referência</Label>
            <Input
              value={novoEndereco.complemento}
              onChange={(e) => setNovoEndereco({ ...novoEndereco, complemento: e.target.value })}
              placeholder="Apto, bloco, próximo a..."
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Latitude (GPS)</Label>
              <Input
                type="number"
                step="0.000001"
                value={novoEndereco.latitude || ""}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, latitude: parseFloat(e.target.value) })}
                placeholder="-23.550520"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Longitude (GPS)</Label>
              <Input
                type="number"
                step="0.000001"
                value={novoEndereco.longitude || ""}
                onChange={(e) => setNovoEndereco({ ...novoEndereco, longitude: parseFloat(e.target.value) })}
                placeholder="-46.633308"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Link Google Maps</Label>
            <Input
              value={novoEndereco.mapa_url}
              onChange={(e) => setNovoEndereco({ ...novoEndereco, mapa_url: e.target.value })}
              placeholder="https://maps.google.com/..."
              className="mt-2"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-green-50 rounded border border-green-200">
            <Checkbox
              checked={salvarNoCliente}
              onCheckedChange={setSalvarNoCliente}
            />
            <Label className="text-sm text-green-900 cursor-pointer">
              💾 Salvar este endereço no cadastro do cliente
            </Label>
          </div>
        </div>
      )}

      {/* Botão Confirmar */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          onClick={handleConfirmar}
          disabled={
            (modo === "selecionar" && !enderecoSelecionado) ||
            (modo === "novo" && (!novoEndereco.cep || !novoEndereco.logradouro)) ||
            salvarEnderecoMutation.isPending
          }
          className="bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {salvarEnderecoMutation.isPending ? 'Salvando...' : 'Confirmar Endereço'}
        </Button>
      </div>
    </div>
  );
}