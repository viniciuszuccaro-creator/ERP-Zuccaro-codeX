import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Busca CEP com auto-completar endereço
 * V12.0 - Com integração ViaCEP
 */
/** @param {{onEnderecoEncontrado: (endereco: {cep: string, logradouro: string, bairro: string,
 * cidade: string, estado: string, complemento: string, numero: string,
 * latitude: number | null, longitude: number | null, mapa_url: string}) => void,
 * enderecoAtual?: {cep?: string}, label?: string}} props */
export default function BuscaCEP({ onEnderecoEncontrado, enderecoAtual, label = "Buscar por CEP" }) {
  const [cep, setCep] = useState(enderecoAtual?.cep || '');
  const [buscando, setBuscando] = useState(false);
  const [encontrado, setEncontrado] = useState(false);

  useEffect(() => {
    if (enderecoAtual?.cep) {
      setCep(enderecoAtual.cep);
    }
  }, [enderecoAtual?.cep]);

  const buscarCEP = async () => {
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }

    setBuscando(true);
    setEncontrado(false);

    try {
      // Buscar na API ViaCEP (gratuita)
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      /** @type {unknown} */
      const data = await response.json();

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Resposta de CEP invalida');
      }

      if ('erro' in data && data.erro) {
        toast.error('CEP não encontrado');
        setBuscando(false);
        return;
      }

      if (!('cep' in data) || typeof data.cep !== 'string' ||
          !('logradouro' in data) || typeof data.logradouro !== 'string' ||
          !('bairro' in data) || typeof data.bairro !== 'string' ||
          !('localidade' in data) || typeof data.localidade !== 'string' ||
          !('uf' in data) || typeof data.uf !== 'string') {
        throw new Error('Resposta de CEP invalida');
      }
      const complemento = 'complemento' in data ? data.complemento : undefined;
      if (complemento != null && typeof complemento !== 'string') {
        throw new Error('Resposta de CEP invalida');
      }

      // Buscar coordenadas GPS via IA
      const coordenadas = await buscarCoordenadasPorEndereco(
        `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`
      );

      const endereco = {
        cep: data.cep,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        complemento: typeof complemento === 'string' ? complemento : '',
        numero: '',
        latitude: coordenadas?.latitude || null,
        longitude: coordenadas?.longitude || null,
        mapa_url: coordenadas?.latitude && coordenadas?.longitude 
          ? `https://www.google.com/maps?q=${coordenadas.latitude},${coordenadas.longitude}`
          : ''
      };

      onEnderecoEncontrado(endereco);
      setEncontrado(true);
      toast.success('✅ Endereço encontrado e preenchido com coordenadas GPS!');

      setTimeout(() => setEncontrado(false), 3000);
    } catch (error) {
      toast.error('Erro ao buscar CEP. Verifique sua conexão.');
    } finally {
      setBuscando(false);
    }
  };

  const buscarCoordenadasPorEndereco = async (enderecoTexto) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoTexto)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar coordenadas:', error);
      return null;
    }
  };

  const formatarCEP = (valor) => {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 5) return numeros;
    return `${numeros.slice(0, 5)}-${numeros.slice(5, 8)}`;
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-2">
        <Input
          value={cep}
          onChange={(e) => setCep(formatarCEP(e.target.value))}
          placeholder="00000-000"
          maxLength={9}
          onKeyPress={(e) => e.key === 'Enter' && buscarCEP()}
          className={encontrado ? 'border-green-500' : ''}
        />
        <Button
          type="button"
          onClick={buscarCEP}
          disabled={buscando || cep.replace(/\D/g, '').length !== 8}
          variant="outline"
          className={encontrado ? 'bg-green-50 border-green-500' : ''}
        >
          {buscando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : encontrado ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        💡 Digite o CEP e clique para preencher automaticamente o endereço
      </p>
    </div>
  );
}
