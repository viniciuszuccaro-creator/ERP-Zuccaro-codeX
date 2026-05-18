import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Upload, UserCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { toast } from "sonner";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function MotoristaForm({ motorista, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || motorista;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.Motorista.criar") || hasPermission?.("Logistica.Motorista.criar");
  const podeEditar = hasPermission?.("Cadastros.Motorista.editar") || hasPermission?.("Logistica.Motorista.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_completo: '',
    cpf: '',
    cnh_numero: '',
    cnh_categoria: 'B',
    cnh_validade: '',
    telefone: '',
    whatsapp: '',
    email: '',
    status: 'Ativo',
    possui_moopp: false,
    rastreador_instalado: false
  });

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('Colaborador', {}, 'nome_completo', 200),
    enabled: contextoValido,
  });

  const cnhValida = formData.cnh_validade && differenceInDays(new Date(formData.cnh_validade), new Date()) > 0;
  const diasVencimento = formData.cnh_validade ? differenceInDays(new Date(formData.cnh_validade), new Date()) : null;
  const alertaVencimento = diasVencimento !== null && diasVencimento < 30 && diasVencimento > 0;

  const schema = z.object({
    nome_completo: z.string().min(1, 'Nome é obrigatório'),
    cnh_numero: z.string().min(3, 'CNH é obrigatória'),
    cnh_categoria: z.string().min(1, 'Categoria é obrigatória')
  });

  const handleSubmit = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      toast.error("Sem permissão para salvar motorista.");
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_completo || formData.nome || ''
    });
  };

  const formContent = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      <div>
        <Label>Nome Completo *</Label>
        <Input
          value={formData.nome_completo}
          onChange={(e) => setFormData({...formData, nome_completo: e.target.value})}
          placeholder="Nome do motorista"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>CPF</Label>
          <Input
            value={formData.cpf}
            onChange={(e) => setFormData({...formData, cpf: e.target.value})}
            placeholder="000.000.000-00"
          />
        </div>
        <div>
          <Label>Telefone/WhatsApp</Label>
          <Input
            value={formData.whatsapp}
            onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>CNH Número *</Label>
          <Input
            value={formData.cnh_numero}
            onChange={(e) => setFormData({...formData, cnh_numero: e.target.value})}
            placeholder="00000000000"
          />
        </div>
        <div>
          <Label>Categoria CNH *</Label>
          <Select value={formData.cnh_categoria} onValueChange={(v) => setFormData({...formData, cnh_categoria: v})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A - Motos</SelectItem>
              <SelectItem value="B">B - Carros</SelectItem>
              <SelectItem value="C">C - Caminhões leves</SelectItem>
              <SelectItem value="D">D - Ônibus</SelectItem>
              <SelectItem value="E">E - Carretas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Validade CNH *</Label>
        <Input
          type="date"
          value={formData.cnh_validade}
          onChange={(e) => setFormData({...formData, cnh_validade: e.target.value})}
        />
        {alertaVencimento && (
          <Alert className="border-orange-200 bg-orange-50 mt-2">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              ⚠️ CNH vence em {diasVencimento} dias!
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div>
        <Label>Vincular a Colaborador</Label>
        <Select value={formData.colaborador_id} onValueChange={(v) => setFormData({...formData, colaborador_id: v})}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o colaborador" />
          </SelectTrigger>
          <SelectContent>
            {colaboradores.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Férias">Férias</SelectItem>
            <SelectItem value="Afastado">Afastado</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.Motorista.salvar"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Cadastrar Motorista'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Motorista' : 'Novo Motorista'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
