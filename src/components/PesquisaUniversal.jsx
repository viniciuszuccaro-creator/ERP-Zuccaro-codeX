import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Users, 
  ShoppingCart, 
  Package, 
  Truck,
  FileText,
  Building2,
  DollarSign,
  Loader2,
  Sparkles,
  Target,
  UserCircle,
  TrendingUp,
  Calendar,
  Briefcase,
  Factory,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

/**
 * Pesquisa Universal (Ctrl+K)
 * Busca em todas as entidades do sistema
 * V21.7: Integrada com sistema multiempresa + Debounce para evitar rate limit
 */
export default function PesquisaUniversal({ open, onOpenChange }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const navigate = useNavigate();
  const { filtrarPorContexto, estaNoGrupo, empresaAtual, grupoAtual } = useContextoVisual();
  const contextoValido = Boolean(grupoAtual?.id || empresaAtual?.id || estaNoGrupo);
  const [erroCarga, setErroCarga] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.length >= 2) {
        buscar();
      } else {
        setResultados([]);
        setErroCarga(false);
      }
    }, 400); // Debounce de 400ms para evitar rate limit

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  const buscar = async () => {
    setBuscando(true);
    setErroCarga(false);

    if (!contextoValido) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    try {
      const q = query.toLowerCase();

      // Escopo multiempresa: filtrarPorContexto(entity) → filterInContext (sem list unscoped).
      const settled = await Promise.allSettled([
        filtrarPorContexto('Cliente', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Pedido', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Produto', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Entrega', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Fornecedor', {}, '-created_date', 100, 'empresa_dona_id'),
        filtrarPorContexto('OrdemProducao', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Colaborador', {}, '-created_date', 100, 'empresa_alocada_id'),
        filtrarPorContexto('ContaPagar', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('ContaReceber', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Oportunidade', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Transportadora', {}, '-created_date', 100, 'empresa_dona_id'),
        filtrarPorContexto('NotaFiscal', {}, '-created_date', 100, 'empresa_faturamento_id'),
        filtrarPorContexto('OrdemCompra', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Interacao', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Comissao', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Campanha', {}, '-created_date', 100, 'empresa_dona_id'),
        filtrarPorContexto('Evento', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Contrato', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('SolicitacaoCompra', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('MovimentacaoEstoque', {}, '-created_date', 100, 'empresa_id'),
        filtrarPorContexto('Representante', {}, '-created_date', 100, 'empresa_dona_id'),
        filtrarPorContexto('CentroCusto', {}, '-created_date', 100, 'empresa_id'),
      ]);

      const take = (i) => settled[i].status === 'fulfilled' ? (settled[i].value || []) : [];
      if (settled.some((r) => r.status === 'rejected')) setErroCarga(true);

      const clientesFiltrados = take(0);
      const pedidosFiltrados = take(1);
      const produtosFiltrados = take(2);
      const entregasFiltradas = take(3);
      const fornecedoresFiltrados = take(4);
      const opsFiltradas = take(5);
      const colaboradoresFiltrados = take(6);
      const contasPagarFiltradas = take(7);
      const contasReceberFiltradas = take(8);
      const oportunidadesFiltradas = take(9);
      const transportadorasFiltradas = take(10);
      const notasFiscaisFiltradas = take(11);
      const ordensCompraFiltradas = take(12);
      const interacoesFiltradas = take(13);
      const comissoesFiltradas = take(14);
      const campanhasFiltradas = take(15);
      const eventosFiltrados = take(16);
      const contratosFiltrados = take(17);
      const solicitacoesCompraFiltradas = take(18);
      const movimentacoesFiltradas = take(19);
      const representantesFiltrados = take(20);
      const centroCustoFiltrados = take(21);

      // Função helper para buscar em arrays de objetos
      const buscarEmArray = (array, campos) => {
        if (!Array.isArray(array)) return false;
        return array.some(item => 
          campos.some(campo => item[campo]?.toLowerCase().includes(q))
        );
      };

      // Aplicar busca textual UNIVERSAL em múltiplos campos - 100% COMPLETO
      const clientes = clientesFiltrados.filter(c => 
        c.nome?.toLowerCase().includes(q) ||
        c.razao_social?.toLowerCase().includes(q) ||
        c.nome_fantasia?.toLowerCase().includes(q) ||
        c.cnpj?.includes(q) ||
        c.cpf?.includes(q) ||
        c.rg?.includes(q) ||
        c.inscricao_estadual?.includes(q) ||
        c.inscricao_municipal?.includes(q) ||
        c.cnae_principal?.includes(q) ||
        c.ramo_atividade?.toLowerCase().includes(q) ||
        c.porte_empresa?.toLowerCase().includes(q) ||
        c.segmento_cliente_id?.toLowerCase().includes(q) ||
        c.regiao_atendimento_nome?.toLowerCase().includes(q) ||
        c.vendedor_responsavel?.toLowerCase().includes(q) ||
        c.indicador_nome?.toLowerCase().includes(q) ||
        c.tipo_indicador?.toLowerCase().includes(q) ||
        c.representante_id?.includes(q) ||
        c.tipo?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.status_fiscal_receita?.toLowerCase().includes(q) ||
        c.status_validacao_kyc?.toLowerCase().includes(q) ||
        c.classificacao_abc?.toLowerCase().includes(q) ||
        c.origem_cadastro?.toLowerCase().includes(q) ||
        c.canal_preferencial?.toLowerCase().includes(q) ||
        c.endereco_principal?.logradouro?.toLowerCase().includes(q) ||
        c.endereco_principal?.bairro?.toLowerCase().includes(q) ||
        c.endereco_principal?.cidade?.toLowerCase().includes(q) ||
        c.endereco_principal?.estado?.toLowerCase().includes(q) ||
        c.endereco_principal?.cep?.includes(q) ||
        c.locais_entrega?.some(l => 
          l?.apelido?.toLowerCase().includes(q) ||
          l?.cidade?.toLowerCase().includes(q) ||
          l?.bairro?.toLowerCase().includes(q) ||
          l?.cep?.includes(q)
        ) ||
        c.observacoes?.toLowerCase().includes(q) ||
        buscarEmArray(c.contatos, ['nome', 'cargo', 'valor'])
      ).slice(0, 5);

      const pedidos = pedidosFiltrados.filter(p =>
        p.numero_pedido?.toLowerCase().includes(q) ||
        p.codigo_interno?.toLowerCase().includes(q) ||
        p.cliente_nome?.toLowerCase().includes(q) ||
        p.cliente_cpf_cnpj?.includes(q) ||
        p.vendedor?.toLowerCase().includes(q) ||
        p.indicador_nome?.toLowerCase().includes(q) ||
        p.obra_destino_nome?.toLowerCase().includes(q) ||
        p.tipo?.toLowerCase().includes(q) ||
        p.tipo_pedido?.toLowerCase().includes(q) ||
        p.origem_pedido?.toLowerCase().includes(q) ||
        p.origem_externa_id?.includes(q) ||
        p.canal_preferencial?.toLowerCase().includes(q) ||
        p.tipo_frete?.toLowerCase().includes(q) ||
        p.forma_pagamento?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q) ||
        p.status_aprovacao?.toLowerCase().includes(q) ||
        p.prioridade?.toLowerCase().includes(q) ||
        p.usuario_solicitante_id?.includes(q) ||
        p.usuario_aprovador_id?.includes(q) ||
        p.endereco_entrega_principal?.cidade?.toLowerCase().includes(q) ||
        p.endereco_entrega_principal?.bairro?.toLowerCase().includes(q) ||
        p.endereco_entrega_principal?.cep?.includes(q) ||
        p.itens_revenda?.some(i => 
          i?.produto_descricao?.toLowerCase().includes(q) ||
          i?.descricao?.toLowerCase().includes(q)
        ) ||
        p.itens_armado_padrao?.some(i => i?.produto_descricao?.toLowerCase().includes(q)) ||
        p.itens_corte_dobra?.some(i => i?.produto_descricao?.toLowerCase().includes(q)) ||
        p.observacoes_publicas?.toLowerCase().includes(q) ||
        p.observacoes_internas?.toLowerCase().includes(q) ||
        p.observacoes_nfe?.toLowerCase().includes(q)
      ).slice(0, 5);

      const produtos = produtosFiltrados.filter(p =>
        p.descricao?.toLowerCase().includes(q) ||
        p.descricao_seo?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.codigo_barras?.includes(q) ||
        p.ncm?.includes(q) ||
        p.cest?.includes(q) ||
        p.cfop_padrao_compra?.includes(q) ||
        p.cfop_padrao_venda?.includes(q) ||
        p.grupo?.toLowerCase().includes(q) ||
        p.grupo_produto_nome?.toLowerCase().includes(q) ||
        p.marca_nome?.toLowerCase().includes(q) ||
        p.setor_atividade_nome?.toLowerCase().includes(q) ||
        p.subgrupo?.toLowerCase().includes(q) ||
        p.tipo_item?.toLowerCase().includes(q) ||
        p.tipo_aco?.toLowerCase().includes(q) ||
        p.origem_mercadoria?.toLowerCase().includes(q) ||
        p.fornecedor_principal?.toLowerCase().includes(q) ||
        p.localizacao?.toLowerCase().includes(q) ||
        p.localizacao_fisica?.corredor?.toLowerCase().includes(q) ||
        p.localizacao_fisica?.rua?.toLowerCase().includes(q) ||
        p.localizacao_fisica?.prateleira?.toLowerCase().includes(q) ||
        p.localizacao_fisica?.posicao?.toLowerCase().includes(q) ||
        p.classificacao_abc?.toLowerCase().includes(q) ||
        p.unidade_principal?.toLowerCase().includes(q) ||
        p.unidade_medida?.toLowerCase().includes(q) ||
        p.modo_cadastro?.toLowerCase().includes(q) ||
        p.tags_busca_ia?.some(t => t?.toLowerCase().includes(q)) ||
        p.lotes?.some(l => 
          l?.numero_lote?.toLowerCase().includes(q) ||
          l?.fornecedor?.toLowerCase().includes(q) ||
          l?.nota_fiscal?.toLowerCase().includes(q)
        ) ||
        p.status?.toLowerCase().includes(q) ||
        p.observacoes?.toLowerCase().includes(q)
      ).slice(0, 5);

      const entregas = entregasFiltradas.filter(e =>
        e.cliente_nome?.toLowerCase().includes(q) ||
        e.numero_pedido?.toLowerCase().includes(q) ||
        e.pedido_id?.includes(q) ||
        e.op_id?.includes(q) ||
        e.nfe_id?.includes(q) ||
        e.qr_code?.toLowerCase().includes(q) ||
        e.codigo_rastreamento?.includes(q) ||
        e.link_publico_rastreamento?.includes(q) ||
        e.regiao_entrega_nome?.toLowerCase().includes(q) ||
        e.motorista?.toLowerCase().includes(q) ||
        e.motorista_telefone?.includes(q) ||
        e.transportadora?.toLowerCase().includes(q) ||
        e.placa?.includes(q) ||
        e.veiculo?.toLowerCase().includes(q) ||
        e.tipo_frete?.toLowerCase().includes(q) ||
        e.prioridade?.toLowerCase().includes(q) ||
        e.romaneio_id?.includes(q) ||
        e.rota_id?.includes(q) ||
        e.endereco_entrega_completo?.logradouro?.toLowerCase().includes(q) ||
        e.endereco_entrega_completo?.numero?.includes(q) ||
        e.endereco_entrega_completo?.bairro?.toLowerCase().includes(q) ||
        e.endereco_entrega_completo?.cidade?.toLowerCase().includes(q) ||
        e.endereco_entrega_completo?.estado?.toLowerCase().includes(q) ||
        e.endereco_entrega_completo?.cep?.includes(q) ||
        e.endereco_entrega_completo?.referencia?.toLowerCase().includes(q) ||
        e.contato_entrega?.nome?.toLowerCase().includes(q) ||
        e.contato_entrega?.telefone?.includes(q) ||
        e.contato_entrega?.whatsapp?.includes(q) ||
        e.contato_entrega?.email?.toLowerCase().includes(q) ||
        e.status?.toLowerCase().includes(q) ||
        e.usuario_responsavel?.toLowerCase().includes(q) ||
        e.comprovante_entrega?.nome_recebedor?.toLowerCase().includes(q) ||
        e.entrega_frustrada?.motivo?.toLowerCase().includes(q) ||
        e.observacoes?.toLowerCase().includes(q)
      ).slice(0, 4);

      const fornecedores = fornecedoresFiltrados.filter(f =>
        f.nome?.toLowerCase().includes(q) ||
        f.razao_social?.toLowerCase().includes(q) ||
        f.nome_fantasia?.toLowerCase().includes(q) ||
        f.cnpj?.includes(q) ||
        f.cpf?.includes(q) ||
        f.inscricao_estadual?.includes(q) ||
        f.inscricao_municipal?.includes(q) ||
        f.cnae_principal?.includes(q) ||
        f.ramo_atividade?.toLowerCase().includes(q) ||
        f.categoria?.toLowerCase().includes(q) ||
        f.tipo_fornecedor?.toLowerCase().includes(q) ||
        f.status_fornecedor?.toLowerCase().includes(q) ||
        f.status_fiscal_receita?.toLowerCase().includes(q) ||
        f.aprovado_por?.toLowerCase().includes(q) ||
        f.motivo_bloqueio?.toLowerCase().includes(q) ||
        f.contato_responsavel?.toLowerCase().includes(q) ||
        f.whatsapp?.includes(q) ||
        f.endereco_principal?.logradouro?.toLowerCase().includes(q) ||
        f.endereco_principal?.bairro?.toLowerCase().includes(q) ||
        f.endereco_principal?.cidade?.toLowerCase().includes(q) ||
        f.endereco_principal?.estado?.toLowerCase().includes(q) ||
        f.endereco_principal?.cep?.includes(q) ||
        f.condicoes_compra?.prazo_pagamento_padrao?.toLowerCase().includes(q) ||
        f.condicoes_compra?.forma_pagamento_padrao?.toLowerCase().includes(q) ||
        f.observacoes?.toLowerCase().includes(q) ||
        buscarEmArray(f.emails, ['email']) ||
        buscarEmArray(f.telefones, ['numero']) ||
        buscarEmArray(f.dados_bancarios, ['banco', 'conta', 'pix_chave', 'favorecido'])
      ).slice(0, 4);

      const ops = opsFiltradas.filter(op =>
        op.numero_op?.toLowerCase().includes(q) ||
        op.pedido_numero?.toLowerCase().includes(q) ||
        op.pedido_id?.includes(q) ||
        op.cliente_nome?.toLowerCase().includes(q) ||
        op.tipo_producao?.toLowerCase().includes(q) ||
        op.descricao_produto?.toLowerCase().includes(q) ||
        op.tipo_peca?.toLowerCase().includes(q) ||
        op.setor_producao?.toLowerCase().includes(q) ||
        op.linha_producao?.toLowerCase().includes(q) ||
        op.operador_responsavel?.toLowerCase().includes(q) ||
        op.responsavel_producao?.toLowerCase().includes(q) ||
        op.turno?.toLowerCase().includes(q) ||
        op.prioridade?.toLowerCase().includes(q) ||
        op.status?.toLowerCase().includes(q) ||
        op.status_qualidade?.toLowerCase().includes(q) ||
        op.motivo_refugo?.toLowerCase().includes(q) ||
        op.itens?.some(i => 
          i?.descricao?.toLowerCase().includes(q) ||
          i?.bitola?.toLowerCase().includes(q) ||
          i?.tipo_aco?.toLowerCase().includes(q)
        ) ||
        op.observacoes_producao?.toLowerCase().includes(q) ||
        op.observacoes?.toLowerCase().includes(q)
      ).slice(0, 4);

      const colaboradores = colaboradoresFiltrados.filter(c =>
        c.nome_completo?.toLowerCase().includes(q) ||
        c.cpf?.includes(q) ||
        c.rg?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.email_corporativo?.toLowerCase().includes(q) ||
        c.telefone?.includes(q) ||
        c.whatsapp?.includes(q) ||
        c.cargo?.toLowerCase().includes(q) ||
        c.departamento?.toLowerCase().includes(q) ||
        c.centro_custo_nome?.toLowerCase().includes(q) ||
        c.turno_id?.includes(q) ||
        c.tipo_contrato?.toLowerCase().includes(q) ||
        c.cnh_numero?.includes(q) ||
        c.cnh_categoria?.toLowerCase().includes(q) ||
        c.endereco?.toLowerCase().includes(q) ||
        c.vincular_a_usuario_id?.includes(q) ||
        c.competencias?.some(comp => comp?.toLowerCase().includes(q)) ||
        c.dados_bancarios?.banco?.toLowerCase().includes(q) ||
        c.dados_bancarios?.conta?.includes(q) ||
        c.dados_bancarios?.pix_chave?.includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.observacoes?.toLowerCase().includes(q)
      ).slice(0, 3);

      const contasPagar = contasPagarFiltradas.filter(c =>
        c.descricao?.toLowerCase().includes(q) ||
        c.fornecedor?.toLowerCase().includes(q) ||
        c.favorecido_cpf_cnpj?.includes(q) ||
        c.numero_documento?.toLowerCase().includes(q) ||
        c.numero_parcela?.includes(q) ||
        c.nota_fiscal_id?.includes(q) ||
        c.ordem_compra_id?.includes(q) ||
        c.categoria?.toLowerCase().includes(q) ||
        c.centro_custo?.toLowerCase().includes(q) ||
        c.projeto_obra?.toLowerCase().includes(q) ||
        c.origem_tipo?.toLowerCase().includes(q) ||
        c.canal_origem?.toLowerCase().includes(q) ||
        c.marketplace_origem?.toLowerCase().includes(q) ||
        c.forma_pagamento?.toLowerCase().includes(q) ||
        c.aprovado_por?.toLowerCase().includes(q) ||
        c.rejeitado_por?.toLowerCase().includes(q) ||
        c.motivo_rejeicao?.toLowerCase().includes(q) ||
        c.comprovante_pagamento_url?.includes(q) ||
        c.detalhes_pagamento?.bandeira_cartao?.toLowerCase().includes(q) ||
        c.detalhes_pagamento?.numero_autorizacao?.includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.status_pagamento?.toLowerCase().includes(q) ||
        c.observacoes?.toLowerCase().includes(q)
      ).slice(0, 3);

      const contasReceber = contasReceberFiltradas.filter(c =>
        c.descricao?.toLowerCase().includes(q) ||
        c.cliente?.toLowerCase().includes(q) ||
        c.cliente_id?.includes(q) ||
        c.numero_documento?.toLowerCase().includes(q) ||
        c.numero_parcela?.includes(q) ||
        c.pedido_id?.includes(q) ||
        c.nota_fiscal_id?.includes(q) ||
        c.centro_custo?.toLowerCase().includes(q) ||
        c.projeto_obra?.toLowerCase().includes(q) ||
        c.origem_tipo?.toLowerCase().includes(q) ||
        c.canal_origem?.toLowerCase().includes(q) ||
        c.marketplace_origem?.toLowerCase().includes(q) ||
        c.forma_recebimento?.toLowerCase().includes(q) ||
        c.forma_cobranca?.toLowerCase().includes(q) ||
        c.id_cobranca_externa?.includes(q) ||
        c.gateway_usado_nome?.toLowerCase().includes(q) ||
        c.boleto_id_integracao?.includes(q) ||
        c.pix_id_integracao?.includes(q) ||
        c.linha_digitavel?.includes(q) ||
        c.boleto_linha_digitavel?.includes(q) ||
        c.codigo_barras?.includes(q) ||
        c.pix_copia_cola?.includes(q) ||
        c.pix_qrcode?.includes(q) ||
        c.nosso_numero?.includes(q) ||
        c.codigo_ocorrencia_retorno?.includes(q) ||
        c.detalhes_pagamento?.bandeira_cartao?.toLowerCase().includes(q) ||
        c.detalhes_pagamento?.numero_autorizacao?.includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.status_cobranca?.toLowerCase().includes(q) ||
        c.status_integracao?.toLowerCase().includes(q) ||
        c.observacoes?.toLowerCase().includes(q)
      ).slice(0, 3);

      const oportunidades = oportunidadesFiltradas.filter(o =>
        o.titulo?.toLowerCase().includes(q) ||
        o.descricao?.toLowerCase().includes(q) ||
        o.cliente_id?.includes(q) ||
        o.cliente_nome?.toLowerCase().includes(q) ||
        o.cliente_email?.toLowerCase().includes(q) ||
        o.cliente_telefone?.includes(q) ||
        o.responsavel?.toLowerCase().includes(q) ||
        o.responsavel_id?.includes(q) ||
        o.origem?.toLowerCase().includes(q) ||
        o.etapa?.toLowerCase().includes(q) ||
        o.temperatura?.toLowerCase().includes(q) ||
        o.concorrente?.toLowerCase().includes(q) ||
        o.motivo_perda?.toLowerCase().includes(q) ||
        o.produtos_interesse?.some(p => p?.toLowerCase().includes(q)) ||
        o.necessidades?.toLowerCase().includes(q) ||
        o.proxima_acao?.toLowerCase().includes(q) ||
        o.prazo_decisao?.toLowerCase().includes(q) ||
        o.pedido_gerado_id?.includes(q) ||
        o.orcamento_gerado_id?.includes(q) ||
        o.status?.toLowerCase().includes(q) ||
        o.observacoes?.toLowerCase().includes(q)
      ).slice(0, 3);

      const transportadoras = transportadorasFiltradas.filter(t =>
        t.razao_social?.toLowerCase().includes(q) ||
        t.nome_fantasia?.toLowerCase().includes(q) ||
        t.cnpj?.includes(q) ||
        t.inscricao_estadual?.includes(q) ||
        t.rntrc?.includes(q) ||
        t.contato_responsavel?.toLowerCase().includes(q) ||
        t.whatsapp?.includes(q) ||
        t.endereco?.toLowerCase().includes(q) ||
        t.cidade?.toLowerCase().includes(q) ||
        t.estado?.toLowerCase().includes(q) ||
        t.cep?.includes(q) ||
        t.tipos_veiculo?.some(v => v?.toLowerCase().includes(q)) ||
        t.regioes_atendimento?.some(r => r?.toLowerCase().includes(q)) ||
        t.tipos_carga_permitidos?.some(tc => tc?.toLowerCase().includes(q)) ||
        t.areas_atendimento?.toLowerCase().includes(q) ||
        t.integracao_rastreamento?.api_url?.includes(q) ||
        t.integracao_rastreamento?.modelo_integracao?.toLowerCase().includes(q) ||
        t.tabela_frete_padrao?.tipo_cobranca?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        t.status_fiscal_receita?.toLowerCase().includes(q) ||
        t.observacoes?.toLowerCase().includes(q) ||
        buscarEmArray(t.emails, ['email']) ||
        buscarEmArray(t.telefones, ['numero'])
      ).slice(0, 2);

      const notasFiscais = notasFiscaisFiltradas.filter(n =>
        n.numero?.toLowerCase().includes(q) ||
        n.serie?.toLowerCase().includes(q) ||
        n.cliente_fornecedor?.toLowerCase().includes(q) ||
        n.cliente_fornecedor_id?.includes(q) ||
        n.cliente_cpf_cnpj?.includes(q) ||
        n.pedido_id?.includes(q) ||
        n.numero_pedido?.toLowerCase().includes(q) ||
        n.chave_acesso?.includes(q) ||
        n.protocolo_autorizacao?.includes(q) ||
        n.numero_lote?.includes(q) ||
        n.recibo_lote?.includes(q) ||
        n.tipo?.toLowerCase().includes(q) ||
        n.modelo?.includes(q) ||
        n.natureza_operacao?.toLowerCase().includes(q) ||
        n.cfop?.includes(q) ||
        n.finalidade?.toLowerCase().includes(q) ||
        n.ambiente?.toLowerCase().includes(q) ||
        n.codigo_status_sefaz?.includes(q) ||
        n.mensagem_sefaz?.toLowerCase().includes(q) ||
        n.motivo_rejeicao?.toLowerCase().includes(q) ||
        n.transportadora?.nome?.toLowerCase().includes(q) ||
        n.transportadora?.cpf_cnpj?.includes(q) ||
        n.transportadora?.placa_veiculo?.includes(q) ||
        n.cliente_endereco?.cidade?.toLowerCase().includes(q) ||
        n.cliente_endereco?.cep?.includes(q) ||
        n.itens?.some(i => 
          i?.descricao?.toLowerCase().includes(q) ||
          i?.codigo_produto?.toLowerCase().includes(q) ||
          i?.ncm?.includes(q) ||
          i?.cest?.includes(q) ||
          i?.cfop?.includes(q)
        ) ||
        n.duplicatas?.some(d => d?.numero?.toLowerCase().includes(q)) ||
        n.status?.toLowerCase().includes(q) ||
        n.observacoes?.toLowerCase().includes(q) ||
        n.informacoes_complementares?.toLowerCase().includes(q)
      ).slice(0, 3);

      const ordensCompra = ordensCompraFiltradas.filter(oc =>
        oc.numero_oc?.toLowerCase().includes(q) ||
        oc.fornecedor_id?.includes(q) ||
        oc.fornecedor_nome?.toLowerCase().includes(q) ||
        oc.solicitacao_compra_id?.includes(q) ||
        oc.solicitante?.toLowerCase().includes(q) ||
        oc.aprovador?.toLowerCase().includes(q) ||
        oc.centro_custo?.toLowerCase().includes(q) ||
        oc.centro_custo_id?.includes(q) ||
        oc.condicao_pagamento?.toLowerCase().includes(q) ||
        oc.forma_pagamento?.toLowerCase().includes(q) ||
        oc.nota_fiscal_entrada?.toLowerCase().includes(q) ||
        oc.itens?.some(i => 
          i?.descricao?.toLowerCase().includes(q) ||
          i?.codigo_sku?.toLowerCase().includes(q) ||
          i?.produto_id?.includes(q)
        ) ||
        oc.historico?.some(h => 
          h?.usuario?.toLowerCase().includes(q) ||
          h?.observacao?.toLowerCase().includes(q)
        ) ||
        oc.status?.toLowerCase().includes(q) ||
        oc.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const interacoes = interacoesFiltradas.filter(i =>
        i.titulo?.toLowerCase().includes(q) ||
        i.descricao?.toLowerCase().includes(q) ||
        i.cliente_nome?.toLowerCase().includes(q) ||
        i.tipo?.toLowerCase().includes(q) ||
        i.responsavel?.toLowerCase().includes(q) ||
        i.resultado?.toLowerCase().includes(q) ||
        i.proxima_acao?.toLowerCase().includes(q) ||
        i.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const comissoes = comissoesFiltradas.filter(c =>
        c.vendedor?.toLowerCase().includes(q) ||
        c.numero_pedido?.toLowerCase().includes(q) ||
        c.cliente?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.aprovador?.toLowerCase().includes(q) ||
        c.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const campanhas = campanhasFiltradas.filter(c =>
        c.nome?.toLowerCase().includes(q) ||
        c.titulo?.toLowerCase().includes(q) ||
        c.descricao?.toLowerCase().includes(q) ||
        c.tipo?.toLowerCase().includes(q) ||
        c.canal?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.responsavel?.toLowerCase().includes(q)
      ).slice(0, 2);

      const eventos = eventosFiltrados.filter(e =>
        e.titulo?.toLowerCase().includes(q) ||
        e.descricao?.toLowerCase().includes(q) ||
        e.tipo?.toLowerCase().includes(q) ||
        e.cliente_nome?.toLowerCase().includes(q) ||
        e.participantes?.some(p => p?.toLowerCase().includes(q)) ||
        e.responsavel?.toLowerCase().includes(q) ||
        e.local?.toLowerCase().includes(q)
      ).slice(0, 2);

      const contratos = contratosFiltrados.filter(c =>
        c.numero_contrato?.toLowerCase().includes(q) ||
        c.titulo?.toLowerCase().includes(q) ||
        c.parte_contratante?.toLowerCase().includes(q) ||
        c.parte_contratante_id?.includes(q) ||
        c.cliente_nome?.toLowerCase().includes(q) ||
        c.fornecedor_nome?.toLowerCase().includes(q) ||
        c.objeto?.toLowerCase().includes(q) ||
        c.descricao?.toLowerCase().includes(q) ||
        c.tipo?.toLowerCase().includes(q) ||
        c.indice_reajuste?.toLowerCase().includes(q) ||
        c.forma_pagamento?.toLowerCase().includes(q) ||
        c.responsavel_empresa?.toLowerCase().includes(q) ||
        c.responsavel?.toLowerCase().includes(q) ||
        c.assinatura_digital?.nome_completo?.toLowerCase().includes(q) ||
        c.assinatura_digital?.ip_address?.includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const solicitacoesCompra = solicitacoesCompraFiltradas.filter(s =>
        s.numero_solicitacao?.toLowerCase().includes(q) ||
        s.produto_id?.includes(q) ||
        s.produto_descricao?.toLowerCase().includes(q) ||
        s.produto_nome?.toLowerCase().includes(q) ||
        s.solicitante?.toLowerCase().includes(q) ||
        s.setor?.toLowerCase().includes(q) ||
        s.aprovador?.toLowerCase().includes(q) ||
        s.ordem_compra_id?.includes(q) ||
        s.unidade_medida?.toLowerCase().includes(q) ||
        s.justificativa?.toLowerCase().includes(q) ||
        s.prioridade?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q) ||
        s.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const movimentacoes = movimentacoesFiltradas.filter(m =>
        m.produto_id?.includes(q) ||
        m.produto_descricao?.toLowerCase().includes(q) ||
        m.codigo_produto?.toLowerCase().includes(q) ||
        m.tipo_movimento?.toLowerCase().includes(q) ||
        m.origem_movimento?.toLowerCase().includes(q) ||
        m.origem_documento_id?.includes(q) ||
        m.documento?.toLowerCase().includes(q) ||
        m.responsavel?.toLowerCase().includes(q) ||
        m.responsavel_id?.includes(q) ||
        m.lote?.toLowerCase().includes(q) ||
        m.centro_custo_nome?.toLowerCase().includes(q) ||
        m.centro_custo_id?.includes(q) ||
        m.localizacao_origem?.toLowerCase().includes(q) ||
        m.localizacao_destino?.toLowerCase().includes(q) ||
        m.empresa_origem_id?.includes(q) ||
        m.empresa_destino_id?.includes(q) ||
        m.transferencia_id?.includes(q) ||
        m.aprovador?.toLowerCase().includes(q) ||
        m.unidade_medida?.toLowerCase().includes(q) ||
        m.motivo?.toLowerCase().includes(q) ||
        m.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const representantes = representantesFiltrados.filter(r =>
        r.nome?.toLowerCase().includes(q) ||
        r.razao_social?.toLowerCase().includes(q) ||
        r.nome_fantasia?.toLowerCase().includes(q) ||
        r.cpf?.includes(q) ||
        r.cnpj?.includes(q) ||
        r.rg?.includes(q) ||
        r.inscricao_estadual?.includes(q) ||
        r.telefone?.includes(q) ||
        r.whatsapp?.includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.tipo?.toLowerCase().includes(q) ||
        r.categoria?.toLowerCase().includes(q) ||
        r.especialidade?.toLowerCase().includes(q) ||
        r.regiao_atuacao?.toLowerCase().includes(q) ||
        r.endereco?.toLowerCase().includes(q) ||
        r.cidade?.toLowerCase().includes(q) ||
        r.estado?.toLowerCase().includes(q) ||
        r.cep?.includes(q) ||
        r.banco?.toLowerCase().includes(q) ||
        r.agencia?.includes(q) ||
        r.conta?.includes(q) ||
        r.pix_chave?.includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const centrosCusto = centroCustoFiltrados.filter(cc =>
        cc.codigo?.toLowerCase().includes(q) ||
        cc.descricao?.toLowerCase().includes(q) ||
        cc.tipo?.toLowerCase().includes(q) ||
        cc.categoria?.toLowerCase().includes(q) ||
        cc.responsavel?.toLowerCase().includes(q) ||
        cc.responsavel_id?.includes(q) ||
        cc.centro_custo_pai_id?.includes(q) ||
        cc.filial_vinculada_id?.includes(q) ||
        cc.conta_contabil_padrao_id?.includes(q) ||
        cc.origem_escopo?.toLowerCase().includes(q) ||
        cc.status?.toLowerCase().includes(q) ||
        cc.observacoes?.toLowerCase().includes(q)
      ).slice(0, 2);

      const todosResultados = [
        ...clientes.map(c => ({
          tipo: 'Cliente',
          icone: Users,
          cor: 'blue',
          titulo: c.nome_fantasia || c.razao_social || c.nome,
          subtitulo: c.cnpj || c.cpf || c.vendedor_responsavel,
          url: createPageUrl('Cadastros') + '?tab=clientes&view=' + c.id,
          data: c
        })),
        ...pedidos.map(p => ({
          tipo: 'Pedido',
          icone: ShoppingCart,
          cor: 'purple',
          titulo: p.numero_pedido,
          subtitulo: `${p.cliente_nome} • ${p.status} • R$ ${p.valor_total?.toLocaleString('pt-BR')}`,
          url: createPageUrl('Comercial') + '?tab=pedidos&edit=' + p.id,
          data: p
        })),
        ...produtos.map(p => ({
          tipo: 'Produto',
          icone: Package,
          cor: 'green',
          titulo: p.descricao,
          subtitulo: `SKU: ${p.codigo} | ${p.grupo_produto_nome || p.grupo || ''} | Estoque: ${p.estoque_atual || 0}`,
          url: createPageUrl('Estoque') + '?tab=produtos&view=' + p.id,
          data: p
        })),
        ...entregas.map(e => ({
          tipo: 'Entrega',
          icone: Truck,
          cor: 'orange',
          titulo: `Entrega - ${e.cliente_nome}`,
          subtitulo: `${e.status} • ${e.endereco_entrega_completo?.cidade || ''}`,
          url: createPageUrl('Expedicao') + '?tab=entregas&view=' + e.id,
          data: e
        })),
        ...fornecedores.map(f => ({
          tipo: 'Fornecedor',
          icone: Building2,
          cor: 'slate',
          titulo: f.nome || f.razao_social,
          subtitulo: `${f.cnpj || f.cpf || ''} • ${f.categoria || ''}`,
          url: createPageUrl('Compras') + '?tab=fornecedores&view=' + f.id,
          data: f
        })),
        ...ops.map(op => ({
          tipo: 'OP',
          icone: Factory,
          cor: 'indigo',
          titulo: op.numero_op,
          subtitulo: `${op.cliente_nome} • ${op.status}`,
          url: createPageUrl('Producao') + '?op=' + op.id,
          data: op
        })),
        ...colaboradores.map(c => ({
          tipo: 'Colaborador',
          icone: UserCircle,
          cor: 'blue',
          titulo: c.nome_completo,
          subtitulo: `${c.cargo || ''} • ${c.departamento || ''} • ${c.status || ''}`,
          url: createPageUrl('RH') + '?tab=colaboradores&view=' + c.id,
          data: c
        })),
        ...contasPagar.map(c => ({
          tipo: 'Conta a Pagar',
          icone: DollarSign,
          cor: 'red',
          titulo: c.descricao,
          subtitulo: `${c.fornecedor || ''} • R$ ${c.valor?.toLocaleString('pt-BR')} • ${c.status}`,
          url: createPageUrl('Financeiro') + '?tab=pagar&view=' + c.id,
          data: c
        })),
        ...contasReceber.map(c => ({
          tipo: 'Conta a Receber',
          icone: DollarSign,
          cor: 'green',
          titulo: c.descricao,
          subtitulo: `${c.cliente || ''} • R$ ${c.valor?.toLocaleString('pt-BR')} • ${c.status}`,
          url: createPageUrl('Financeiro') + '?tab=receber&view=' + c.id,
          data: c
        })),
        ...oportunidades.map(o => ({
          tipo: 'Oportunidade',
          icone: TrendingUp,
          cor: 'purple',
          titulo: o.titulo,
          subtitulo: `${o.cliente_nome} • ${o.etapa} • R$ ${o.valor_estimado?.toLocaleString('pt-BR')}`,
          url: createPageUrl('CRM') + '?tab=oportunidades&view=' + o.id,
          data: o
        })),
        ...transportadoras.map(t => ({
          tipo: 'Transportadora',
          icone: Truck,
          cor: 'orange',
          titulo: t.razao_social || t.nome_fantasia,
          subtitulo: `${t.cnpj || ''} • ${t.contato_responsavel || ''}`,
          url: createPageUrl('Cadastros') + '?tab=transportadoras&view=' + t.id,
          data: t
        })),
        ...notasFiscais.map(n => ({
          tipo: 'NF-e',
          icone: FileText,
          cor: 'blue',
          titulo: `NF ${n.numero}/${n.serie}`,
          subtitulo: `${n.cliente_fornecedor} • ${n.status} • R$ ${n.valor_total?.toLocaleString('pt-BR')}`,
          url: createPageUrl('Fiscal') + '?tab=notas&view=' + n.id,
          data: n
        })),
        ...ordensCompra.map(oc => ({
          tipo: 'Ordem de Compra',
          icone: Briefcase,
          cor: 'slate',
          titulo: oc.numero_oc,
          subtitulo: `${oc.fornecedor_nome} • ${oc.status} • R$ ${oc.valor_total?.toLocaleString('pt-BR')}`,
          url: createPageUrl('Compras') + '?tab=ordens&view=' + oc.id,
          data: oc
        })),
        ...interacoes.map(i => ({
          tipo: 'Interação',
          icone: Calendar,
          cor: 'purple',
          titulo: i.titulo,
          subtitulo: `${i.tipo} • ${i.cliente_nome} • ${i.responsavel}`,
          url: createPageUrl('CRM') + '?tab=interacoes&view=' + i.id,
          data: i
        })),
        ...comissoes.map(c => ({
          tipo: 'Comissão',
          icone: DollarSign,
          cor: 'green',
          titulo: `Comissão - ${c.vendedor}`,
          subtitulo: `${c.numero_pedido} • R$ ${c.valor_comissao?.toLocaleString('pt-BR')} • ${c.status}`,
          url: createPageUrl('Comercial') + '?tab=comissoes&view=' + c.id,
          data: c
        })),
        ...campanhas.map(c => ({
          tipo: 'Campanha',
          icone: Target,
          cor: 'purple',
          titulo: c.nome || c.titulo,
          subtitulo: `${c.tipo || ''} • ${c.canal || ''} • ${c.status || ''}`,
          url: createPageUrl('CRM') + '?tab=campanhas&view=' + c.id,
          data: c
        })),
        ...eventos.map(e => ({
          tipo: 'Evento',
          icone: Calendar,
          cor: 'blue',
          titulo: e.titulo,
          subtitulo: `${e.tipo || ''} • ${e.cliente_nome || e.local || ''} • ${new Date(e.data_inicio).toLocaleDateString('pt-BR')}`,
          url: createPageUrl('Agenda') + '?view=' + e.id,
          data: e
        })),
        ...contratos.map(c => ({
          tipo: 'Contrato',
          icone: FileText,
          cor: 'indigo',
          titulo: c.numero_contrato || c.titulo,
          subtitulo: `${c.cliente_nome || c.fornecedor_nome || ''} • ${c.status || ''}`,
          url: createPageUrl('Contratos') + '?view=' + c.id,
          data: c
        })),
        ...solicitacoesCompra.map(s => ({
          tipo: 'Sol. Compra',
          icone: Briefcase,
          cor: 'orange',
          titulo: s.numero_solicitacao,
          subtitulo: `${s.produto_descricao} • ${s.solicitante} • ${s.status}`,
          url: createPageUrl('Estoque') + '?tab=solicitacoes&view=' + s.id,
          data: s
        })),
        ...movimentacoes.map(m => ({
          tipo: 'Movimentação',
          icone: TrendingUp,
          cor: 'blue',
          titulo: `${m.tipo_movimento || ''} - ${m.produto_descricao}`,
          subtitulo: `${m.quantidade || 0} ${m.unidade_medida || ''} • ${m.documento || ''} • ${new Date(m.data_movimentacao).toLocaleDateString('pt-BR')}`,
          url: createPageUrl('Estoque') + '?tab=movimentacoes&view=' + m.id,
          data: m
        })),
        ...representantes.map(r => ({
          tipo: 'Representante',
          icone: User,
          cor: 'purple',
          titulo: r.nome || r.razao_social,
          subtitulo: `${r.tipo || ''} • ${r.categoria || ''} • ${r.telefone || r.email || ''}`,
          url: createPageUrl('Cadastros') + '?tab=representantes&view=' + r.id,
          data: r
        })),
        ...centrosCusto.map(cc => ({
          tipo: 'Centro de Custo',
          icone: Briefcase,
          cor: 'slate',
          titulo: `${cc.codigo} - ${cc.descricao}`,
          subtitulo: `${cc.tipo || ''} • ${cc.categoria || ''} • ${cc.responsavel || ''}`,
          url: createPageUrl('Cadastros') + '?tab=centros-custo&view=' + cc.id,
          data: cc
        }))
      ];

      setResultados(todosResultados);

    } catch (error) {
      console.error('Erro ao buscar:', error);
      setErroCarga(true);
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const handleSelect = (resultado) => {
    navigate(resultado.url);
    onOpenChange(false);
    setQuery('');
  };

  const cores = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    red: 'bg-red-100 text-red-700'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar em TODOS os módulos: nome, CPF, CNPJ, email, telefone, descrição..."
              className="pl-10 text-lg border-0 focus-visible:ring-0"
              autoFocus
            />
            {buscando && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 w-5 h-5 animate-spin" />
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {!contextoValido && query.length >= 2 && (
            <p className="p-4 text-sm text-amber-800">Selecione grupo ou empresa para pesquisar.</p>
          )}
          {erroCarga && (
            <p className="px-4 py-2 text-xs text-slate-500">Resultados parciais (erro de carga ≠ zero).</p>
          )}
          {resultados.length > 0 ? (
            <div className="space-y-1">
              {resultados.map((resultado, idx) => {
                const Icon = resultado.icone;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(resultado)}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-3"
                  >
                    <div className={`p-2 rounded-lg ${cores[resultado.cor]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{resultado.titulo}</p>
                        <Badge variant="outline" className="text-xs">
                          {resultado.tipo}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">{resultado.subtitulo}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 && !buscando ? (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum resultado encontrado para "{query}"</p>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Digite para buscar em TODO o sistema (14+ módulos)</p>
              <p className="text-xs mt-2">Clientes • Pedidos • Produtos • Entregas • Fornecedores • OPs • Colaboradores • Pagar • Receber • Oportunidades • NF-e • OCs • Interações • Transportadoras • Comissões • Campanhas • Eventos • Contratos • Sol. Compra • Movimentações • Representantes • Centros Custo</p>
            </div>
          )}
        </div>

        <div className="border-t p-3 bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span>↑↓ Navegar</span>
              <span>↵ Selecionar</span>
              <span>Esc Fechar</span>
            </div>
            <div className="flex items-center gap-2">
              {estaNoGrupo ? (
                <Badge variant="outline" className="text-xs">
                  <Target className="w-3 h-3 mr-1" />
                  Todas Empresas
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  {empresaAtual?.nome_fantasia || 'Empresa Atual'}
                </Badge>
              )}
              <span>{resultados.length} resultado(s)</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}