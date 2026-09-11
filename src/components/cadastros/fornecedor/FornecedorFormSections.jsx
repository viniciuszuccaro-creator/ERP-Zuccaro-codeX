import React from "react";
import { Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";

const documentValue = (data) => data.cpf_cnpj || data.cpf || data.cnpj || "";

export function FornecedorDadosGeraisSection({ formData, setFormData, fornecedor, handleDadosCNPJ, handleDadosRNTRC, canEditDocument }) {
  const pessoaFisica = formData.tipo_pessoa === "Pessoa Fisica";
  const documento = documentValue(formData);
  const updateDocumento = (value) => setFormData({ ...formData, cpf_cnpj: value, cpf: pessoaFisica ? value : "", cnpj: pessoaFisica ? "" : value });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label htmlFor="nome">Nome / Razão Social *</Label><Input id="nome" value={formData.nome || ""} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required /></div>
      <div><Label htmlFor="razao_social">Razão Social</Label><Input id="razao_social" value={formData.razao_social || ""} onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })} /></div>
      <div><Label htmlFor="nome_fantasia">Nome Fantasia</Label><Input id="nome_fantasia" value={formData.nome_fantasia || ""} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })} /></div>

      <div>
        <Label htmlFor="tipo_pessoa">Tipo de pessoa</Label>
        <Select value={formData.tipo_pessoa || "Pessoa Juridica"} onValueChange={(value) => setFormData({ ...formData, tipo_pessoa: value, cpf_cnpj: "", cpf: "", cnpj: "" })} disabled={!canEditDocument}>
          <SelectTrigger id="tipo_pessoa" data-permission="Cadastros.Pessoas.Fornecedor.documento.editar" data-sensitive><SelectValue /></SelectTrigger>
          <SelectContent className="z-[99999]"><SelectItem value="Pessoa Juridica">Pessoa Jurídica</SelectItem><SelectItem value="Pessoa Fisica">Pessoa Física</SelectItem></SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="cpf_cnpj">{pessoaFisica ? "CPF" : "CNPJ"}</Label>
        <Input id="cpf_cnpj" value={documento} onChange={(e) => updateDocumento(e.target.value)} placeholder={pessoaFisica ? "000.000.000-00" : "00.000.000/0000-00"} maxLength={18} disabled={!canEditDocument} data-permission="Cadastros.Pessoas.Fornecedor.documento.editar" data-sensitive />
      </div>

      {!pessoaFisica && <div><Label>&nbsp;</Label><BotaoBuscaAutomatica tipo="cnpj" valor={documento} onDadosEncontrados={handleDadosCNPJ} disabled={!canEditDocument || documento.replace(/\D/g, "").length !== 14} /></div>}
      <div><Label htmlFor="inscricao_estadual">Inscrição Estadual</Label><Input id="inscricao_estadual" value={formData.inscricao_estadual || ""} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!canEditDocument} data-permission="Cadastros.Pessoas.Fornecedor.documento.editar" data-sensitive /></div>

      <div>
        <Label htmlFor="categoria">Categoria *</Label>
        <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
          <SelectTrigger id="categoria"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[99999]"><SelectItem value="Matéria Prima">Matéria Prima</SelectItem><SelectItem value="Equipamentos">Equipamentos</SelectItem><SelectItem value="Serviços">Serviços</SelectItem><SelectItem value="Transporte">Transporte</SelectItem><SelectItem value="Tecnologia">Tecnologia</SelectItem><SelectItem value="Outros">Outros</SelectItem></SelectContent>
        </Select>
      </div>

      {formData.categoria === "Transporte" && <><div><Label htmlFor="rntrc">RNTRC (ANTT)</Label><Input id="rntrc" value={formData.rntrc || ""} onChange={(e) => setFormData({ ...formData, rntrc: e.target.value })} placeholder="00000000" /></div><div><Label>&nbsp;</Label><BotaoBuscaAutomatica tipo="rntrc" valor={formData.rntrc} onDadosEncontrados={handleDadosRNTRC} disabled={!formData.rntrc} /></div></>}

      <div><Label htmlFor="prazo_entrega_padrao">Prazo Entrega Padrão (dias)</Label><Input id="prazo_entrega_padrao" type="number" value={formData.prazo_entrega_padrao || 0} onChange={(e) => setFormData({ ...formData, prazo_entrega_padrao: Number(e.target.value) || 0 })} /></div>
      <div>
        <Label htmlFor="status_fornecedor">Status do Fornecedor</Label>
        <Select value={formData.status_fornecedor} onValueChange={(value) => setFormData({ ...formData, status_fornecedor: value })}><SelectTrigger id="status_fornecedor"><SelectValue /></SelectTrigger><SelectContent className="z-[99999]"><SelectItem value="Em Análise">Em Análise</SelectItem><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Bloqueado">Bloqueado</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent></Select>
      </div>
      <div><Label htmlFor="status">Status</Label><Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}><SelectTrigger id="status"><SelectValue /></SelectTrigger><SelectContent className="z-[99999]"><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent></Select></div>

      {fornecedor?.id && (
        <div className="border-t pt-4 md:col-span-2"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><p className="text-sm text-slate-600">Última Compra</p><p className="font-semibold">{formData.ultima_compra ? new Date(formData.ultima_compra).toLocaleDateString("pt-BR") : "-"}</p></div>
          <div><p className="text-sm text-slate-600">Total de Compras</p><p className="font-semibold">{formData.quantidade_compras || 0}</p></div>
          <div><p className="text-sm text-slate-600">Nota Média</p><div className="flex items-center gap-2"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= (formData.nota_media || 0) ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`} />)}</div><span className="font-semibold">{(formData.nota_media || 0).toFixed(1)}</span></div></div>
        </div></div>
      )}
    </div>
  );
}

export function FornecedorContatoEnderecoSection({ formData, setFormData, handleDadosCEP, canEditContact, canEditBilling }) {
  const cobranca = formData.endereco_cobranca || {};
  const updateCobranca = (field, value) => setFormData({ ...formData, endereco_cobranca: { ...cobranca, [field]: value } });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
      <div><Label htmlFor="telefone">Telefone</Label><Input id="telefone" value={formData.telefone || ""} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} /></div>
      <div className="md:col-span-2"><Label htmlFor="contato_responsavel">Contato Responsável</Label><Input id="contato_responsavel" value={formData.contato_responsavel || ""} onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })} placeholder="Nome do responsável" /></div>
      <div className="md:col-span-2"><Label htmlFor="website">Website</Label><Input id="website" type="url" value={formData.website || ""} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://empresa.com.br" maxLength={240} disabled={!canEditContact} data-permission="Cadastros.Pessoas.Fornecedor.contato.editar" /></div>
      <div><Label htmlFor="cep">CEP</Label><Input id="cep" value={formData.cep || ""} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} placeholder="00000-000" /></div>
      <div><Label>&nbsp;</Label><BotaoBuscaAutomatica tipo="cep" valor={formData.cep} onDadosEncontrados={handleDadosCEP} disabled={!formData.cep || formData.cep.replace(/\D/g, "").length < 8} /></div>
      <div className="md:col-span-2"><Label htmlFor="endereco">Endereço Completo</Label><Input id="endereco" value={formData.endereco || ""} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua e número" /></div>
      <div><Label htmlFor="bairro">Bairro</Label><Input id="bairro" value={formData.bairro || ""} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} maxLength={120} disabled={!canEditContact} data-permission="Cadastros.Pessoas.Fornecedor.contato.editar" data-sensitive /></div>
      <div><Label htmlFor="cidade">Cidade</Label><Input id="cidade" value={formData.cidade || ""} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} /></div>
      <div><Label htmlFor="estado">Estado</Label><Input id="estado" value={formData.estado || ""} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} maxLength={2} placeholder="SP" /></div>

      <div className="border-t pt-4 md:col-span-2"><h3 className="text-sm font-semibold text-slate-800">Endereço de cobrança</h3></div>
      <div className="md:col-span-2"><Label htmlFor="cobranca_endereco">Endereço</Label><Input id="cobranca_endereco" value={cobranca.endereco || ""} onChange={(e) => updateCobranca("endereco", e.target.value)} disabled={!canEditBilling} data-permission="Cadastros.Pessoas.Fornecedor.endereco_cobranca.editar" data-sensitive /></div>
      <div><Label htmlFor="cobranca_bairro">Bairro</Label><Input id="cobranca_bairro" value={cobranca.bairro || ""} onChange={(e) => updateCobranca("bairro", e.target.value)} disabled={!canEditBilling} data-permission="Cadastros.Pessoas.Fornecedor.endereco_cobranca.editar" data-sensitive /></div>
      <div><Label htmlFor="cobranca_cidade">Cidade</Label><Input id="cobranca_cidade" value={cobranca.cidade || ""} onChange={(e) => updateCobranca("cidade", e.target.value)} disabled={!canEditBilling} data-permission="Cadastros.Pessoas.Fornecedor.endereco_cobranca.editar" data-sensitive /></div>
      <div><Label htmlFor="cobranca_estado">Estado</Label><Input id="cobranca_estado" value={cobranca.estado || ""} onChange={(e) => updateCobranca("estado", e.target.value)} maxLength={2} disabled={!canEditBilling} data-permission="Cadastros.Pessoas.Fornecedor.endereco_cobranca.editar" data-sensitive /></div>
      <div><Label htmlFor="cobranca_cep">CEP</Label><Input id="cobranca_cep" value={cobranca.cep || ""} onChange={(e) => updateCobranca("cep", e.target.value)} maxLength={12} disabled={!canEditBilling} data-permission="Cadastros.Pessoas.Fornecedor.endereco_cobranca.editar" data-sensitive /></div>
    </div>
  );
}
