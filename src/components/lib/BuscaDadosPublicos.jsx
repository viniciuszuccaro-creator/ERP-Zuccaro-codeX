import React from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validarSugestaoNcmConsultaIA, validarSugestaoRntrcConsultaIA } from '@/components/lib/iaResponsePolicy';

/**
 * 🌐 BUSCA AUTOMÁTICA DE DADOS PÚBLICOS
 * V21.2 - Sistema de autocomplete inteligente
 * 
 * Funcionalidades:
 * - CNPJ/CPF: Receita Federal via IA
 * - CEP: ViaCEP
 * - NCM: sugestao IA nao verificada, para revisao manual
 * - RNTRC: sugestao IA nao verificada, sem validacao cadastral
 */

/**
 * Buscar dados de CNPJ na Receita Federal via IA
 * @param {string} cnpj - CNPJ formatado ou não
 * @returns {Promise<object>} Dados da empresa
 */
export async function buscarDadosCNPJ(cnpj) {
  const cnpjLimpo = cnpj?.replace(/\D/g, '') || '';
  
  console.log('🔍 [Frontend] Iniciando busca CNPJ');
  
  if (cnpjLimpo.length !== 14) {
    console.error('❌ [Frontend] CNPJ inválido');
    return {
      sucesso: false,
      erro: 'CNPJ deve ter 14 dígitos'
    };
  }

  // ===== TENTATIVA 1: Backend Function (se habilitado) =====
  try {
    console.log('📡 [Frontend] Tentando backend function...');
    const response = await base44.functions.invoke('ConsultarCNPJ', { cnpj: cnpjLimpo });
    const resultado = response?.data;
    
    console.log('📦 [Frontend] Backend retornou');
    
    if (resultado && resultado.sucesso) {
      console.log('✅ [Frontend] Backend SUCESSO');
      return resultado;
    }
    
    if (resultado && !resultado.sucesso) {
      console.warn('⚠️ [Frontend] Backend sem sucesso');
      // Continua para fallback direto
    }
  } catch (error) {
    console.warn('⚠️ [Frontend] Backend não disponível');
    // Fallback para busca direta no frontend
  }

  // ===== TENTATIVA 2: Busca Direta no Frontend (Fallback) =====
  console.log('🔄 [Frontend] Usando fallback direto (CORS livre)...');
  
  // Tentar BrasilAPI primeiro (tem CORS livre)
  try {
    console.log('📡 [Frontend] Chamando BrasilAPI direto...');
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    
    console.log('📦 [Frontend] BrasilAPI status:', response.status);
    
    if (response.ok) {
      const dados = await response.json();
      console.log('✅ [Frontend] BrasilAPI SUCESSO');
      
      if (dados.razao_social) {
        return {
          sucesso: true,
          fonte: 'BrasilAPI (Frontend)',
          dados: {
            razao_social: dados.razao_social || '',
            nome_fantasia: dados.nome_fantasia || dados.razao_social || '',
            inscricao_estadual: dados.inscricao_estadual || 'ISENTO',
            inscricao_municipal: dados.inscricao_municipal || '',
            situacao_cadastral: dados.descricao_situacao_cadastral || 'ATIVA',
            data_abertura: dados.data_inicio_atividade || '',
            porte: dados.porte || '',
            natureza_juridica: dados.descricao_natureza_juridica || '',
            cnae_principal: dados.cnae_fiscal_descricao || '',
            cnae_codigo: dados.cnae_fiscal?.toString() || '',
            capital_social: dados.capital_social?.toString() || '0',
            endereco_completo: {
              logradouro: dados.descricao_tipo_de_logradouro ? 
                `${dados.descricao_tipo_de_logradouro} ${dados.logradouro || ''}`.trim() : 
                dados.logradouro || '',
              numero: dados.numero || 'S/N',
              complemento: dados.complemento || '',
              bairro: dados.bairro || '',
              cidade: dados.municipio || '',
              uf: dados.uf || '',
              cep: dados.cep?.replace(/\D/g, '') || ''
            },
            telefone: dados.ddd_telefone_1 ? `${dados.ddd_telefone_1}`.replace(/\D/g, '') : '',
            email: dados.email || ''
          }
        };
      }
    }
  } catch (error) {
    console.error('❌ [Frontend] BrasilAPI falhou');
  }

  // ===== TODAS AS TENTATIVAS FALHARAM =====
  console.error('❌ [Frontend] Todas as tentativas falharam');
  return {
    sucesso: false,
    erro: '❌ CNPJ não encontrado. Verifique se digitou corretamente ou tente novamente.'
  };
}

/**
 * Buscar dados de CPF via IA (apenas validação + nome se público)
 * @param {string} cpf - CPF formatado ou não
 * @returns {Promise<object>} Status do CPF
 */
export async function buscarDadosCPF(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  if (cpfLimpo.length !== 11) {
    return {
      sucesso: false,
      erro: 'CPF deve ter 11 dígitos'
    };
  }

  // Validação local usando algoritmo oficial
  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return {
      sucesso: false,
      erro: 'CPF inválido'
    };
  }
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let digito1 = resto > 9 ? 0 : resto;
  
  if (digito1 !== parseInt(cpfLimpo.charAt(9))) {
    return {
      sucesso: false,
      erro: 'CPF inválido'
    };
  }
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let digito2 = resto > 9 ? 0 : resto;
  
  if (digito2 !== parseInt(cpfLimpo.charAt(10))) {
    return {
      sucesso: false,
      erro: 'CPF inválido'
    };
  }

  const formatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  return {
    sucesso: true,
    dados: {
      valido: true,
      formatado: formatado
    }
  };
}

/**
 * Buscar endereço por CEP (ViaCEP + coordenadas)
 * @param {string} cep - CEP formatado ou não
 * @returns {Promise<object>} Dados do endereço
 */
export async function buscarEnderecoCEP(cep) {
  try {
    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      throw new Error('CEP inválido - deve ter 8 dígitos');
    }

    // 1. Buscar via ViaCEP
    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!resposta.ok) {
      throw new Error('Erro ao buscar CEP na API ViaCEP');
    }
    
    const dadosViaCep = await resposta.json();
    
    if (dadosViaCep.erro) {
      throw new Error('CEP não encontrado');
    }

    // 2. Buscar coordenadas GPS via OpenStreetMap Nominatim
    const enderecoCompleto = `${dadosViaCep.logradouro}, ${dadosViaCep.bairro}, ${dadosViaCep.localidade}, ${dadosViaCep.uf}, Brasil`;
    const urlNominatim = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(enderecoCompleto)}&format=json&limit=1`;
    
    let latitude = null;
    let longitude = null;
    
    try {
      const respostaGPS = await fetch(urlNominatim, {
        headers: {
          'User-Agent': 'ERP-Zuccaro/1.0'
        }
      });
      
      if (respostaGPS.ok) {
        const dadosGPS = await respostaGPS.json();
        if (dadosGPS && dadosGPS.length > 0) {
          latitude = parseFloat(dadosGPS[0].lat);
          longitude = parseFloat(dadosGPS[0].lon);
        }
      }
    } catch (erroGPS) {
      console.warn('Não foi possível obter coordenadas GPS');
    }

    return {
      sucesso: true,
      dados: {
        logradouro: dadosViaCep.logradouro || '',
        bairro: dadosViaCep.bairro || '',
        cidade: dadosViaCep.localidade || '',
        uf: dadosViaCep.uf || '',
        latitude: latitude,
        longitude: longitude,
        ddd: dadosViaCep.ddd || ''
      }
    };

  } catch (error) {
    return {
      sucesso: false,
      erro: error.message || 'Erro ao buscar CEP'
    };
  }
}

/**
 * Buscar informações de NCM (código fiscal de produtos)
 * @param {string} ncm - Código NCM (8 dígitos)
 * @returns {Promise<object>} Descrição e alíquotas
 */
export async function buscarDadosNCM(ncm) {
  try {
    const ncmLimpo = ncm.replace(/\D/g, '');
    
    if (ncmLimpo.length !== 8) {
      throw new Error('NCM deve ter 8 dígitos');
    }

    const resultado = validarSugestaoNcmConsultaIA(await base44.integrations.Core.InvokeLLM({
      prompt: `Apresente uma sugestao nao verificada sobre o NCM ${ncmLimpo}. Nao afirme consulta ou confirmacao oficial. A revisao em fonte oficial e obrigatoria antes do preenchimento manual.
      
      Retorne:
      - descricao (descricao sugerida do produto)
      - unidade (unidade padrão: KG, UN, MT, etc)
      - aliquota_ipi (% de IPI médio)
      - aliquota_pis (% de PIS padrão)
      - aliquota_cofins (% de COFINS padrão)
      - cest (código CEST se aplicável)
      - obs (observações sobre tributação especial)
      
      Se NCM inválido, retorne {"erro": "NCM não encontrado"}`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          erro: { type: "string" },
          descricao: { type: "string" },
          unidade: { type: "string" },
          aliquota_ipi: { type: "number" },
          aliquota_pis: { type: "number" },
          aliquota_cofins: { type: "number" },
          cest: { type: "string" },
          obs: { type: "string" }
        }
      }
    }));

    return {
      sucesso: true,
      verificado: false,
      fonte: 'Sugestao IA nao verificada',
      codigo_consultado: ncmLimpo,
      sugestao: resultado
    };

  } catch (error) {
    return {
      sucesso: false,
      erro: error?.message === 'NCM deve ter 8 dígitos' ? 'NCM deve ter 8 dígitos' : 'Nao foi possivel obter uma sugestao NCM valida.'
    };
  }
}

/**
 * Validar RNTRC de transportadora (ANTT)
 * @param {string} rntrc - Código RNTRC
 * @returns {Promise<object>} Status da transportadora
 */
export async function buscarDadosRNTRC(rntrc) {
  try {
    const resultado = validarSugestaoRntrcConsultaIA(await base44.integrations.Core.InvokeLLM({
      prompt: `Apresente uma sugestao nao verificada sobre o RNTRC ${rntrc}. Nao afirme consulta ou validacao na ANTT. A revisao em fonte oficial e obrigatoria antes do preenchimento manual.
      
      Retorne:
      - valido (true/false)
      - situacao (Ativo, Suspenso, Cancelado)
      - tipo_registro (ETC, TAC, CTC)
      - categoria (se disponível)
      
      Se RNTRC não encontrado, retorne {"erro": "RNTRC não encontrado"}`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          erro: { type: "string" },
          valido: { type: "boolean" },
          situacao: { type: "string" },
          tipo_registro: { type: "string" },
          categoria: { type: "string" }
        }
      }
    }));

    return {
      sucesso: true,
      verificado: false,
      fonte: 'Sugestao IA nao verificada',
      codigo_consultado: rntrc,
      sugestao: resultado
    };

  } catch (error) {
    return {
      sucesso: false,
      erro: 'Nao foi possivel obter uma sugestao RNTRC valida.'
    };
  }
}

/**
 * Componente de Botão de Busca Automática V21.5
 * Integração completa com backend functions para dados reais
 */
export function BotaoBuscaAutomatica({ tipo, valor, onDadosEncontrados, disabled, ...buttonProps }) {
  const [buscando, setBuscando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);

  const funcoesBusca = {
    cnpj: buscarDadosCNPJ,
    cpf: buscarDadosCPF,
    cep: buscarEnderecoCEP,
    ncm: buscarDadosNCM,
    rntrc: buscarDadosRNTRC
  };

  const labels = {
    cnpj: '🔍 Buscar CNPJ Real',
    cpf: '✅ Validar CPF',
    cep: '📍 Buscar CEP',
    ncm: '📊 Buscar NCM',
    rntrc: '🚛 Validar RNTRC'
  };

  const handleBuscar = async () => {
    if (!valor || valor.trim() === '') {
      setResultado({ sucesso: false, erro: 'Digite um valor válido' });
      return;
    }

    setBuscando(true);
    setResultado(null);

    try {
      const funcao = funcoesBusca[tipo];
      if (!funcao) {
        throw new Error('Tipo de busca inválido');
      }

      const res = await funcao(valor);
      setResultado(res);

      if (res.sucesso && res.verificado !== false && onDadosEncontrados) {
        onDadosEncontrados(res.dados);
      }
    } catch (error) {
      setResultado({ 
        sucesso: false, 
        erro: error.message || 'Erro ao buscar dados' 
      });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleBuscar}
        disabled={disabled || buscando || !valor}
        variant="outline"
        size="sm"
        className="w-full"
        {...buttonProps}
      >
        {buscando ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Buscando na Receita...
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            {labels[tipo] || 'Buscar'}
          </>
        )}
      </Button>

      {resultado && (
        <Alert className={resultado.verificado === false ? 'border-amber-300 bg-amber-50' : resultado.sucesso ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
          {resultado.sucesso && resultado.verificado !== false ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <AlertDescription className="text-xs">
            {resultado.sucesso && resultado.verificado === false ? (
              <div className="text-amber-900 break-words">
                <p className="font-semibold">Sugestao IA nao verificada</p>
                <p>Codigo consultado: {resultado.codigo_consultado}</p>
                <p>Revise em fonte oficial antes de preencher manualmente. Nenhum campo foi preenchido ou validado automaticamente.</p>
                <dl className="mt-2 space-y-1">
                  {Object.entries(resultado.sugestao).map(([campo, valorSugerido]) => (
                    <div key={campo}><dt className="font-medium">{campo.replaceAll('_', ' ')} (sugerido)</dt><dd>{typeof valorSugerido === 'boolean' ? (valorSugerido ? 'Sim' : 'Nao') : String(valorSugerido)}</dd></div>
                  ))}
                </dl>
              </div>
            ) : resultado.sucesso ? (
              <div className="text-green-900">
                <p className="font-semibold">✅ Dados REAIS preenchidos!</p>
                {resultado.fonte && (
                  <p className="text-[10px] opacity-70 mt-1">Fonte: {resultado.fonte}</p>
                )}
              </div>
            ) : (
              <span className="text-red-900">{resultado.erro}</span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Hook customizado para busca automática
 */
export function useBuscaAutomatica(tipo) {
  const [buscando, setBuscando] = React.useState(false);
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [sugestao, setSugestao] = React.useState(null);

  const buscar = async (valor) => {
    setBuscando(true);
    setErro(null);
    setDados(null);
    setSugestao(null);

    const funcoesBusca = {
      cnpj: buscarDadosCNPJ,
      cpf: buscarDadosCPF,
      cep: buscarEnderecoCEP,
      ncm: buscarDadosNCM,
      rntrc: buscarDadosRNTRC
    };

    const funcao = funcoesBusca[tipo];
    if (!funcao) {
      setErro('Tipo de busca inválido');
      setBuscando(false);
      return;
    }

    const resultado = await funcao(valor);
    
    if (resultado.sucesso && resultado.verificado === false) {
      setSugestao(resultado.sugestao);
    } else if (resultado.sucesso) {
      setDados(resultado.dados);
    } else {
      setErro(resultado.erro);
    }

    setBuscando(false);
    return resultado;
  };

  return { buscar, buscando, dados, erro, sugestao };
}

export default {
  buscarDadosCNPJ,
  buscarDadosCPF,
  buscarEnderecoCEP,
  buscarDadosNCM,
  buscarDadosRNTRC,
  BotaoBuscaAutomatica,
  useBuscaAutomatica
};
