import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  MapPin,
  Phone,
  Mail,
  FileText,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Eye
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { toast } from "sonner";

export default function Empresas() {
  const { filterInContext, createInContext, updateInContext, getFiltroContexto, grupoAtual, empresaAtual } = useContextoVisual();
  const groupIdCadastro = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [viewingEmpresa, setViewingEmpresa] = useState(null);
  const [formData, setFormData] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    regime_tributario: "Simples Nacional",
    tipo: "Matriz",
    endereco: {
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: ""
    },
    contato: {
      telefone: "",
      email: ""
    },
    status: "Ativa",
    permite_emissao_fiscal: true
  });

  const queryClient = useQueryClient();

  const empresaSchema = z.object({
    razao_social: z.string().min(2, 'Informe a razão social'),
    nome_fantasia: z.string().optional().default(''),
    cnpj: z.string().min(14, 'CNPJ inválido'),
    inscricao_estadual: z.string().optional().default(''),
    regime_tributario: z.string().min(2, 'Selecione o regime'),
    tipo: z.enum(['Matriz','Filial']).default('Matriz'),
    endereco: z.object({
      logradouro: z.string().optional().default(''),
      numero: z.string().optional().default(''),
      bairro: z.string().optional().default(''),
      cidade: z.string().optional().default(''),
      estado: z.string().optional().default(''),
      cep: z.string().optional().default('')
    }).optional().default({}),
    contato: z.object({
      telefone: z.string().optional().default(''),
      email: z.string().email('E-mail inválido').optional().or(z.literal(''))
    }).optional().default({}),
    status: z.enum(['Ativa','Inativa','Suspensa']).default('Ativa'),
    permite_emissao_fiscal: z.boolean().default(true)
  });

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas-cadastro', groupIdCadastro],
    queryFn: () => filterInContext('Empresa', {}, '-created_date', undefined, 'group_id'),
    enabled: Boolean(groupIdCadastro),
  });

  const invalidateEmpresasQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['empresas-cadastro'] });
    queryClient.invalidateQueries({ queryKey: ['empresas'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => createInContext('Empresa', data, 'group_id'),
    onSuccess: () => {
      invalidateEmpresasQueries();
      setIsDialogOpen(false);
      resetForm();
      toast.success("Empresa cadastrada com sucesso!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateInContext('Empresa', id, data, 'group_id'),
    onSuccess: () => {
      invalidateEmpresasQueries();
      setIsDialogOpen(false);
      setEditingEmpresa(null);
      resetForm();
      toast.success("Empresa atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(error?.message || 'Falha ao atualizar empresa.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEmpresa) {
      updateMutation.mutate({ id: editingEmpresa.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];
  const TIPOS = ['Matriz', 'Filial'];

  const handleEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setFormData({
      razao_social: empresa.razao_social || '',
      nome_fantasia: empresa.nome_fantasia || '',
      cnpj: empresa.cnpj || '',
      inscricao_estadual: empresa.inscricao_estadual || '',
      regime_tributario: REGIMES.includes(empresa.regime_tributario)
        ? empresa.regime_tributario
        : 'Simples Nacional',
      tipo: TIPOS.includes(empresa.tipo) ? empresa.tipo : 'Matriz',
      endereco: {
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
        ...(empresa.endereco || {}),
      },
      contato: {
        telefone: '',
        email: '',
        ...(empresa.contato || {}),
      },
      status: empresa.status || 'Ativa',
      permite_emissao_fiscal: empresa.permite_emissao_fiscal !== false,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      inscricao_estadual: "",
      regime_tributario: "Simples Nacional",
      tipo: "Matriz",
      endereco: {
        logradouro: "",
        numero: "",
        bairro: "",
        cidade: "",
        estado: "",
        cep: ""
      },
      contato: {
        telefone: "",
        email: ""
      },
      status: "Ativa",
      permite_emissao_fiscal: true
    });
  };

  const filteredEmpresas = empresas.filter(e =>
    e.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cnpj?.includes(searchTerm)
  );

  const statusColors = {
    'Ativa': 'bg-green-100 text-green-700 border-green-200',
    'Inativa': 'bg-gray-100 text-gray-700 border-gray-200',
    'Suspensa': 'bg-red-100 text-red-700 border-red-200'
  };

  const tipoColors = {
    'Matriz': 'bg-blue-500 text-white',
    'Filial': 'bg-purple-500 text-white'
  };

  // KPIs gerais
  const totalEmpresas = empresas.length;
  const empresasAtivas = empresas.filter(e => e.status === 'Ativa').length;
  const matrizes = empresas.filter(e => e.tipo === 'Matriz').length;
  const filiais = empresas.filter(e => e.tipo === 'Filial').length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Gestão de Empresas e Filiais
          </h1>
          <p className="text-slate-600">Controle multi-empresa e consolidação corporativa</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Total de Empresas</p>
                <p className="text-2xl font-bold text-blue-600">{totalEmpresas}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Empresas Ativas</p>
                <p className="text-2xl font-bold text-green-600">{empresasAtivas}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Matrizes</p>
                <p className="text-2xl font-bold text-indigo-600">{matrizes}</p>
              </div>
              <Building2 className="w-8 h-8 text-indigo-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">Filiais</p>
                <p className="text-2xl font-bold text-purple-600">{filiais}</p>
              </div>
              <Building2 className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Buscar empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700"
          data-action="empresa-nova"
          onClick={() => {
            setEditingEmpresa(null);
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingEmpresa(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-action="empresa-form-dialog">
            <DialogHeader>
              <DialogTitle>{editingEmpresa ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            </DialogHeader>
            <FormWrapper
              key={editingEmpresa?.id || 'nova-empresa'}
              schema={empresaSchema}
              defaultValues={formData}
              withContext={false}
              onSubmit={(values) => {
                const groupId = editingEmpresa?.group_id
                  || editingEmpresa?.grupo_id
                  || groupIdCadastro;
                const payload = {
                  ...values,
                  ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
                };
                if (editingEmpresa) {
                  updateMutation.mutate({ id: editingEmpresa.id, data: payload });
                } else {
                  createMutation.mutate(payload);
                }
              }}
            >
              {(methods) => (
                <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="razao_social">Razão Social *</Label>
                  <Input id="razao_social" {...methods.register('razao_social')} />
                </div>
                <div>
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input id="nome_fantasia" {...methods.register('nome_fantasia')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input id="cnpj" {...methods.register('cnpj')} />
                </div>
                <div>
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input id="inscricao_estadual" {...methods.register('inscricao_estadual')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="regime_tributario">Regime Tributário</Label>
                  <Select
                    value={methods.watch('regime_tributario')}
                    onValueChange={(value) => methods.setValue('regime_tributario', value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                      <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                      <SelectItem value="MEI">MEI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={methods.watch('tipo')}
                    onValueChange={(value) => methods.setValue('tipo', value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Matriz">Matriz</SelectItem>
                      <SelectItem value="Filial">Filial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Endereço */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Endereço</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="endereco.cep">CEP</Label>
                    <Input id="endereco.cep" {...methods.register('endereco.cep')} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="endereco.logradouro">Logradouro</Label>
                    <Input id="endereco.logradouro" {...methods.register('endereco.logradouro')} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <Label htmlFor="endereco.numero">Número</Label>
                    <Input id="endereco.numero" {...methods.register('endereco.numero')} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="endereco.bairro">Bairro</Label>
                    <Input id="endereco.bairro" {...methods.register('endereco.bairro')} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="col-span-2">
                    <Label htmlFor="endereco.cidade">Cidade</Label>
                    <Input id="endereco.cidade" {...methods.register('endereco.cidade')} />
                  </div>
                  <div>
                    <Label htmlFor="endereco.estado">UF</Label>
                    <Input id="endereco.estado" maxLength={2} {...methods.register('endereco.estado')} />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Contato</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contato.telefone">Telefone</Label>
                    <Input id="contato.telefone" {...methods.register('contato.telefone')} />
                  </div>
                  <div>
                    <Label htmlFor="contato.email">E-mail</Label>
                    <Input id="contato.email" type="email" {...methods.register('contato.email')} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editingEmpresa ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </div>
            )}
            </FormWrapper>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Empresas */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmpresas.map((empresa) => (
                <TableRow key={empresa.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{empresa.nome_fantasia || empresa.razao_social}</p>
                        <p className="text-xs text-slate-500">{empresa.razao_social}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{empresa.cnpj}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={tipoColors[empresa.tipo]}>
                      {empresa.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{empresa.regime_tributario}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{empresa.endereco?.cidade || '-'}/{empresa.endereco?.estado || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[empresa.status]}>
                      {empresa.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setViewingEmpresa(empresa);
                        }}
                        title="Ver detalhes"
                        data-action="empresa-view"
                        aria-label={`Ver detalhes ${empresa.nome_fantasia || empresa.razao_social || ''}`}
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span className="text-xs hidden sm:inline">Ver</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEdit(empresa);
                        }}
                        title="Editar"
                        data-action="empresa-edit"
                        aria-label={`Editar ${empresa.nome_fantasia || empresa.razao_social || ''}`}
                      >
                        <Edit className="w-4 h-4 text-slate-600" />
                        <span className="text-xs hidden sm:inline">Editar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredEmpresas.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma empresa encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={!!viewingEmpresa} onOpenChange={() => setViewingEmpresa(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {viewingEmpresa?.nome_fantasia || viewingEmpresa?.razao_social}
            </DialogTitle>
          </DialogHeader>
          {viewingEmpresa && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Cadastrais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Razão Social</p>
                      <p className="font-medium">{viewingEmpresa.razao_social}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Nome Fantasia</p>
                      <p className="font-medium">{viewingEmpresa.nome_fantasia || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">CNPJ</p>
                      <p className="font-medium font-mono">{viewingEmpresa.cnpj}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Inscrição Estadual</p>
                      <p className="font-medium">{viewingEmpresa.inscricao_estadual || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-600">Regime Tributário</p>
                      <p className="font-medium">{viewingEmpresa.regime_tributario}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Tipo</p>
                      <Badge className={tipoColors[viewingEmpresa.tipo]}>
                        {viewingEmpresa.tipo}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {viewingEmpresa.endereco?.logradouro}, {viewingEmpresa.endereco?.numero}<br/>
                    {viewingEmpresa.endereco?.bairro} - {viewingEmpresa.endereco?.cidade}/{viewingEmpresa.endereco?.estado}<br/>
                    CEP: {viewingEmpresa.endereco?.cep}
                  </p>
                </CardContent>
              </Card>

              {/* Contato */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-600" />
                    Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{viewingEmpresa.contato?.telefone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{viewingEmpresa.contato?.email || '-'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}