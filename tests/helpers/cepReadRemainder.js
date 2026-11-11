import assert from 'node:assert/strict';
export const cepReadHunks = [
  [
    " * Busca CEP com auto-completar endereço\n * V12.0 - Com integração ViaCEP\n */\n/** @param {{onEnderecoEncontrado: (endereco: {cep: string, logradouro: string, bairro: string,\n * cidade: string, estado: string, complemento: string, numero: string,\n * latitude: number | null, longitude: number | null, mapa_url: string}) => void,\n * enderecoAtual?: {cep?: string}, label?: string}} props */\nexport default function BuscaCEP({ onEnderecoEncontrado, enderecoAtual, label = \"Buscar por CEP\" }) {\n  const [cep, setCep] = useState(enderecoAtual?.cep || '');\n  const [buscando, setBuscando] = useState(false);\n",
    " * Busca CEP com auto-completar endereço\n * V12.0 - Com integração ViaCEP\n */\nexport default function BuscaCEP({ onEnderecoEncontrado, enderecoAtual, label = \"Buscar por CEP\" }) {\n  const [cep, setCep] = useState(enderecoAtual?.cep || '');\n  const [buscando, setBuscando] = useState(false);\n"
  ],
  [
    "    try {\n      // Buscar na API ViaCEP (gratuita)\n      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);\n      /** @type {unknown} */\n      const data = await response.json();\n\n      if (!data || typeof data !== 'object' || Array.isArray(data)) {\n        throw new Error('Resposta de CEP invalida');\n      }\n\n      if ('erro' in data && data.erro) {\n        toast.error('CEP não encontrado');\n        setBuscando(false);\n        return;\n      }\n\n      if (!('cep' in data) || typeof data.cep !== 'string' ||\n          !('logradouro' in data) || typeof data.logradouro !== 'string' ||\n          !('bairro' in data) || typeof data.bairro !== 'string' ||\n          !('localidade' in data) || typeof data.localidade !== 'string' ||\n          !('uf' in data) || typeof data.uf !== 'string') {\n        throw new Error('Resposta de CEP invalida');\n      }\n      const complemento = 'complemento' in data ? data.complemento : undefined;\n      if (complemento != null && typeof complemento !== 'string') {\n        throw new Error('Resposta de CEP invalida');\n      }\n\n      // Buscar coordenadas GPS via IA\n      const coordenadas = await buscarCoordenadasPorEndereco(\n        `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`\n",
    "    try {\n      // Buscar na API ViaCEP (gratuita)\n      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);\n      const data = await response.json();\n\n      if (data.erro) {\n        toast.error('CEP não encontrado');\n        setBuscando(false);\n        return;\n      }\n\n      // Buscar coordenadas GPS via IA\n      const coordenadas = await buscarCoordenadasPorEndereco(\n        `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`\n"
  ],
  [
    "        bairro: data.bairro,\n        cidade: data.localidade,\n        estado: data.uf,\n        complemento: typeof complemento === 'string' ? complemento : '',\n        numero: '',\n        latitude: coordenadas?.latitude || null,\n        longitude: coordenadas?.longitude || null,\n",
    "        bairro: data.bairro,\n        cidade: data.localidade,\n        estado: data.uf,\n        complemento: data.complemento || '',\n        numero: '',\n        latitude: coordenadas?.latitude || null,\n        longitude: coordenadas?.longitude || null,\n"
  ],
  [
    "      </p>\n    </div>\n  );\n}\n",
    "      </p>\n    </div>\n  );\n}\n"
  ]
];
export function cepReadRemainder(text) {
  let source = text.replace(/\r\n/g, '\n');
  for (const [current, previous] of cepReadHunks) {
    assert.equal(source.split(current).length - 1, 1, 'exact CEP read hunk');
    source = source.replace(current, previous);
  }
  assert.ok(source.endsWith('\n') && !source.endsWith('\n\n'));
  return source.slice(0, -1);
}
