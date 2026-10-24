// Somente a proposta visual DEV consome estes objetos em memória.
// Não são cadastros, não entram no store/cache operacional nem reservam IDs/códigos.
export function createComercialProposalFixture() {
  return {
    clientesEmpresa:[{id:'preview-vinculo',cliente_id:'preview-cliente',codigo:'000001',ativo:true,habilitado_operacao:true}],
    clientes:[{id:'preview-cliente',codigo:'000001',razao_social:'Cliente SINTÉTICO da proposta',ativo:true}],
    condicoes:[{id:'preview-condicao',codigo:'001',nome:'Condição ilustrativa',ativo:true}],
    produtos:[{id:'preview-produto',codigo:'000001',descricao:'Produto SINTÉTICO da proposta',ativo:true,unidade_medida_id:'preview-unidade',preco_venda:'10.00'}],
    unidades:[{id:'preview-unidade',sigla:'UN',ativo:true}],
    tabelas:[{id:'preview-tabela',codigo:'001',nome:'Tabela ilustrativa',ativo:true}],
  };
}
