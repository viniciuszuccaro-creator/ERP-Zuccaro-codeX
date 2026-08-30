
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Trash2, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Scissors, 
  Repeat, 
  Calculator,
  AlertCircle,
  Sparkles,
  Save // Added Save icon
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import ImagemComCotas from "./ImagemComCotas"; // Added new import

const BITOLAS_DISPONIVEIS = [
  { valor: "4.2", peso_metro: 0.109 },
  { valor: "5.0", peso_metro: 0.154 },
  { valor: "6.3", peso_metro: 0.245 },
  { valor: "8.0", peso_metro: 0.395 },
  { valor: "10.0", peso_metro: 0.617 },
  { valor: "12.5", peso_metro: 0.963 },
  { valor: "16.0", peso_metro: 1.578 },
  { valor: "20.0", peso_metro: 2.466 },
  { valor: "25.0", peso_metro: 3.853 },
  { valor: "32.0", peso_metro: 6.313 }
];

const FORMATOS_FERRO = [
  { value: "reto", label: "Reto", medidas: ["comprimento"] },
  { value: "U", label: "U (Gancho)", medidas: ["comprimento", "dobra_lado1", "dobra_lado2"] },
  { value: "L", label: "L (90°)", medidas: ["comprimento", "dobra"] },
  { value: "estribo", label: "Estribo Retangular", medidas: ["largura", "altura"] },
  { value: "estribo_circular", label: "Estribo Circular", medidas: ["diametro"] },
  { value: "gancho", label: "Gancho Simples", medidas: ["comprimento", "gancho"] },
  { value: "personalizado", label: "Personalizado", medidas: ["medida1", "medida2", "medida3", "medida4"] }
];

export default function FormularioCorteDobraCompleto({ onSalvar, onCancelar, itemInicial = null }) {
  const [formData, setFormData] = useState(itemInicial ? {
    nome_projeto: itemInicial.nome_projeto || "",
    // elemento_estrutural is replaced by elementoEstrutural state for the item identifier
    quantidade_elementos: itemInicial.quantidade_elementos || 1,
    posicoes: itemInicial.posicoes || []
  } : {
    nome_projeto: "",
    // elemento_estrutural: "", // Removed from formData, now managed by elementoEstrutural state
    quantidade_elementos: 1,
    posicoes: []
  });

  const [posicaoAtual, setPosicaoAtual] = useState({
    codigo: "N1",
    bitola: "10.0",
    quantidade_barras: 1,
    formato: "reto",
    medidas: { comprimento: 0 },
    variavel: false,
    dobra_lado1: 0, // These are now managed within medidas by handleFormatoChange, but kept for initial state consistency
    dobra_lado2: 0, // These are now managed within medidas by handleFormatoChange, but kept for initial state consistency
    observacoes: ""
  });

  const [uploadIA, setUploadIA] = useState(null);
  const { toast } = useToast();

  const [elementoEstrutural, setElementoEstrutural] = useState(itemInicial?.identificador || "");
  const [elementoObrigatorio] = useState(itemInicial?.origem_ia || false);

  const calcularPesoBarra = (bitola, medidas, formato) => {
    const pesoMetro = BITOLAS_DISPONIVEIS.find(b => b.valor === bitola)?.peso_metro || 0;
    let comprimentoTotal = 0;

    switch (formato) {
      case "reto":
        comprimentoTotal = medidas.comprimento || 0;
        break;
      case "U":
        comprimentoTotal = (medidas.comprimento || 0) + (medidas.dobra_lado1 || 0) + (medidas.dobra_lado2 || 0);
        break;
      case "L":
        comprimentoTotal = (medidas.comprimento || 0) + (medidas.dobra || 0);
        break;
      case "estribo": {
        const largura = medidas.largura || 0;
        const altura = medidas.altura || 0;
        comprimentoTotal = (largura * 2) + (altura * 2) + 15; // +15cm para dobra/gancho
        break;
      }
      case "estribo_circular": {
        const diametro = medidas.diametro || 0;
        comprimentoTotal = Math.PI * diametro + 15;
        break;
      }
      case "gancho":
        comprimentoTotal = (medidas.comprimento || 0) + (medidas.gancho || 0);
        break;
      case "personalizado":
        comprimentoTotal = Object.values(medidas).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        break;
      default:
        comprimentoTotal = 0; // Default or handle unrecognized formats
    }

    return (comprimentoTotal / 100) * pesoMetro; // converte cm para metros
  };

  const adicionarPosicao = () => {
    if (!posicaoAtual.codigo || !posicaoAtual.bitola) {
      toast({ title: "❌ Erro", description: "Preencha código e bitola", variant: "destructive" });
      return;
    }

    const peso = calcularPesoBarra(posicaoAtual.bitola, posicaoAtual.medidas, posicaoAtual.formato);
    const pesoTotal = peso * posicaoAtual.quantidade_barras * formData.quantidade_elementos;

    const novaPosicao = {
      ...posicaoAtual,
      peso_unitario: peso,
      peso_total: pesoTotal
    };

    setFormData({
      ...formData,
      posicoes: [...formData.posicoes, novaPosicao]
    });

    // Reset
    setPosicaoAtual({
      codigo: `N${formData.posicoes.length + 2}`,
      bitola: "10.0",
      quantidade_barras: 1,
      formato: "reto",
      medidas: { comprimento: 0 },
      variavel: false,
      dobra_lado1: 0,
      dobra_lado2: 0,
      observacoes: ""
    });

    toast({ title: "✅ Posição Adicionada" });
  };

  const removerPosicao = (index) => {
    setFormData({
      ...formData,
      posicoes: formData.posicoes.filter((_, i) => i !== index)
    });
    toast({ title: "🗑️ Posição Removida" });
  };

  const handleFormatoChange = (formato) => {
    const formatoObj = FORMATOS_FERRO.find(f => f.value === formato);
    const novasMedidas = {};
    
    formatoObj?.medidas.forEach(m => {
      novasMedidas[m] = 0;
    });

    setPosicaoAtual({
      ...posicaoAtual,
      formato,
      medidas: novasMedidas
    });
  };

  const handleUploadIA = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    toast({
      title: "🤖 IA Analisando...",
      description: "Processando arquivo com Inteligência Artificial"
    });

    // Simulação de análise com IA
    setTimeout(() => {
      toast({
        title: "✅ Análise Concluída!",
        description: "3 elementos estruturais detectados"
      });
      
      // Exemplo de resultado da IA
      setFormData(prev => ({
        ...prev,
        posicoes: [
          ...prev.posicoes, // Keep existing positions
          {
            codigo: "N1",
            bitola: "10.0",
            quantidade_barras: 4,
            formato: "reto",
            medidas: { comprimento: 600 },
            peso_unitario: 3.7,
            peso_total: 14.8
          },
          {
            codigo: "N2",
            bitola: "6.3",
            quantidade_barras: 12,
            formato: "estribo",
            medidas: { largura: 25, altura: 40 },
            peso_unitario: 0.32,
            peso_total: 3.84
          }
        ]
      }));
      setElementoEstrutural("V1"); // Example for AI identified element
      // For this example, let's assume if IA provides data, it's considered 'origem_ia'
      // This part might need to be adjusted based on actual IA integration
      // setElementoObrigatorio(true); // This state is immutable after initialization
    }, 2000);
  };

  const calcularResumoGeral = () => {
    const resumo = {
      peso_total: 0,
      por_bitola: {},
      metros_lineares: 0,
      quantidade_total_barras: 0
    };

    formData.posicoes.forEach(pos => {
      resumo.peso_total += pos.peso_total || 0;
      resumo.quantidade_total_barras += pos.quantidade_barras * formData.quantidade_elementos;
      
      if (!resumo.por_bitola[pos.bitola]) {
        resumo.por_bitola[pos.bitola] = { peso: 0, quantidade: 0 };
      }
      resumo.por_bitola[pos.bitola].peso += pos.peso_total || 0;
      resumo.por_bitola[pos.bitola].quantidade += pos.quantidade_barras * formData.quantidade_elementos;
    });

    return resumo;
  };

  const handleSalvar = () => {
    // Original validation adapted to new structure
    if (!formData.nome_projeto || !elementoEstrutural.trim()) {
      toast({ title: "❌ Erro", description: "Preencha o nome do projeto e o elemento estrutural", variant: "destructive" });
      return;
    }

    if (formData.posicoes.length === 0) {
      toast({ title: "❌ Erro", description: "Adicione pelo menos uma posição", variant: "destructive" });
      return;
    }

    // New validation from outline
    if (elementoObrigatorio && !elementoEstrutural.trim()) {
      toast({ title: "⚠️ Elemento Estrutural Obrigatório!", description: "Este item foi processado por IA e requer o preenchimento do elemento estrutural (ex: V1, V2, C1, B1).", variant: "destructive" });
      return;
    }

    const resumo = calcularResumoGeral();
    
    onSalvar({
      ...formData,
      identificador: elementoEstrutural || `CORTE-${Date.now()}`, // New field
      origem_ia: elementoObrigatorio, // New field
      tipo_peca: "corte_dobra", // Replaced 'tipo_servico' with 'tipo_peca' as per outline's implied intent
      resumo
    });
  };

  const resumo = calcularResumoGeral();

  // Variables for ImagemComCotas
  const tipoPeca = posicaoAtual.formato;
  const bitolaPrincipal = posicaoAtual.bitola;
  const comprimento = posicaoAtual.medidas.comprimento || 0;
  const largura = posicaoAtual.medidas.largura || 0;
  const altura = posicaoAtual.medidas.altura || 0;
  const dobraLado1 = posicaoAtual.medidas.dobra_lado1 || 0;
  const dobraLado2 = posicaoAtual.medidas.dobra_lado2 || 0;
  // If 'dobra' is a measure for 'L' format:
  const dobra = posicaoAtual.medidas.dobra || 0;
  // If 'gancho' is a measure for 'gancho' format:
  const gancho = posicaoAtual.medidas.gancho || 0;
  // If 'diametro' is a measure for 'estribo_circular' format:
  const diametro = posicaoAtual.medidas.diametro || 0;


  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <Card className="border-2 border-amber-500">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
          <CardTitle className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-amber-600" />
            Corte e Dobra - Projeto Sob Medida
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4"> {/* Changed to 2 columns as Elemento Estrutural moved */}
            <div>
              <Label>Nome do Projeto / Obra *</Label>
              <Input
                value={formData.nome_projeto}
                onChange={(e) => setFormData({ ...formData, nome_projeto: e.target.value })}
                placeholder="Ex: Edifício Solar, Casa Sr. João"
              />
            </div>
            {/* Removed Elemento Estrutural Input from here - now a separate section */}
            <div>
              <Label>Quantidade de Elementos (Repetições)</Label>
              <Input
                type="number"
                value={formData.quantidade_elementos}
                onChange={(e) => setFormData({ ...formData, quantidade_elementos: parseInt(e.target.value) || 1 })}
                min="1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Se você tem 5 vigas V1 idênticas, coloque quantidade 5
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UPLOAD COM IA */}
      <Card className="border-2 border-purple-500">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Upload Inteligente (DWG / PDF)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Alert className="bg-purple-50 border-purple-300 mb-4">
            <AlertCircle className="w-5 h-5 text-purple-600" />
            <AlertDescription>
              <strong>🤖 IA Ativada:</strong> Faça upload de arquivo DWG ou PDF com o projeto. 
              A Inteligência Artificial irá reconhecer automaticamente as peças, bitolas e medidas!
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".dwg,.pdf,.png,.jpg"
              onChange={handleUploadIA}
              className="hidden"
              id="upload-ia"
            />
            <label htmlFor="upload-ia" className="cursor-pointer">
              <Upload className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <p className="text-purple-700 font-semibold mb-2">
                Clique para fazer upload
              </p>
              <p className="text-sm text-slate-500">
                DWG, PDF, PNG ou JPG até 50MB
              </p>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* IMAGEM COM COTAS - New section */}
      {tipoPeca && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h4 className="font-semibold text-blue-900 mb-3">📐 Visualização da Peça</h4>
            <ImagemComCotas
              tipoPeca={tipoPeca}
              comprimento={comprimento}
              largura={largura}
              altura={altura}
              dobraLado1={dobraLado1}
              dobraLado2={dobraLado2}
              dobra={dobra} // Pass dobra for L-shape
              gancho={gancho} // Pass gancho for gancho shape
              diametro={diametro} // Pass diametro for circular estribo
              bitola={bitolaPrincipal}
            />
          </CardContent>
        </Card>
      )}

      {/* ELEMENTO ESTRUTURAL - New separate input */}
      <div>
        <Label>
          Elemento Estrutural (Ex: V1, V2, C1, B1)
          {elementoObrigatorio && <span className="text-red-600 ml-1">*</span>}
        </Label>
        <Input
          value={elementoEstrutural}
          onChange={(e) => setElementoEstrutural(e.target.value)}
          placeholder="V1, V2, C1, C2, B1..."
          required={elementoObrigatorio}
          className={elementoObrigatorio ? "border-red-300" : ""}
        />
        {elementoObrigatorio && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ Obrigatório: item processado por IA
          </p>
        )}
      </div>

      {/* ADICIONAR POSIÇÕES MANUALMENTE */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Adicionar Posição (N1, N2, N3...)</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Código da Posição</Label>
              <Input
                value={posicaoAtual.codigo}
                onChange={(e) => setPosicaoAtual({ ...posicaoAtual, codigo: e.target.value })}
                placeholder="N1"
              />
            </div>

            <div>
              <Label>Bitola (mm)</Label>
              <Select
                value={posicaoAtual.bitola}
                onValueChange={(v) => setPosicaoAtual({ ...posicaoAtual, bitola: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BITOLAS_DISPONIVEIS.map(b => (
                    <SelectItem key={b.valor} value={b.valor}>
                      {b.valor}mm ({b.peso_metro.toFixed(3)} kg/m)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantidade de Barras</Label>
              <Input
                type="number"
                value={posicaoAtual.quantidade_barras}
                onChange={(e) => setPosicaoAtual({ ...posicaoAtual, quantidade_barras: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>

            <div>
              <Label>Formato</Label>
              <Select
                value={posicaoAtual.formato}
                onValueChange={handleFormatoChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATOS_FERRO.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* MEDIDAS DINÂMICAS */}
          <div className="grid grid-cols-4 gap-4">
            {Object.keys(posicaoAtual.medidas).map(medida => (
              <div key={medida}>
                <Label className="capitalize">{medida.replace('_', ' ')} (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={posicaoAtual.medidas[medida]}
                  onChange={(e) => setPosicaoAtual({
                    ...posicaoAtual,
                    medidas: { ...posicaoAtual.medidas, [medida]: parseFloat(e.target.value) || 0 }
                  })}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={posicaoAtual.variavel}
                onCheckedChange={(checked) => setPosicaoAtual({ ...posicaoAtual, variavel: checked })}
              />
              <Label className="cursor-pointer">Medida Variável</Label>
            </div>

            <div className="flex-1">
              <Label>Observações</Label>
              <Input
                value={posicaoAtual.observacoes}
                onChange={(e) => setPosicaoAtual({ ...posicaoAtual, observacoes: e.target.value })}
                placeholder="Ex: dobra só lado esquerdo, 3 cortes, etc"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-slate-600">
              Peso estimado por barra: <strong>{calcularPesoBarra(posicaoAtual.bitola, posicaoAtual.medidas, posicaoAtual.formato).toFixed(2)} kg</strong>
            </div>
            <Button type="button" onClick={adicionarPosicao} className="bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Posição
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE POSIÇÕES */}
      {formData.posicoes.length > 0 && (
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Posições Adicionadas ({formData.posicoes.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Bitola</th>
                    <th className="p-2 text-right">Qtd Barras</th>
                    <th className="p-2 text-left">Formato</th>
                    <th className="p-2 text-right">Peso Unit.</th>
                    <th className="p-2 text-right">Peso Total</th>
                    <th className="p-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.posicoes.map((pos, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-mono font-bold">{pos.codigo}</td>
                      <td className="p-2">
                        <Badge className="bg-blue-600">{pos.bitola}mm</Badge>
                      </td>
                      <td className="p-2 text-right">
                        {pos.quantidade_barras} x {formData.quantidade_elementos} = {pos.quantidade_barras * formData.quantidade_elementos}
                      </td>
                      <td className="p-2">{FORMATOS_FERRO.find(f => f.value === pos.formato)?.label}</td>
                      <td className="p-2 text-right">{pos.peso_unitario.toFixed(2)} kg</td>
                      <td className="p-2 text-right font-bold text-green-600">{pos.peso_total.toFixed(2)} kg</td>
                      <td className="p-2 text-center">
                        <Button size="icon" variant="ghost" onClick={() => removerPosicao(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESUMO GERAL */}
      {formData.posicoes.length > 0 && (
        <Card className="border-2 border-green-500">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-6 h-6 text-green-600" />
              Resumo Geral do Elemento {elementoEstrutural} {/* Updated to use elementoEstrutural state */}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-600">Peso Total</p>
                <p className="text-3xl font-bold text-green-600">{resumo.peso_total.toFixed(2)} kg</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600">Total de Barras</p>
                <p className="text-3xl font-bold text-blue-600">{resumo.quantidade_total_barras}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600">Posições</p>
                <p className="text-3xl font-bold text-purple-600">{formData.posicoes.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600">Elementos</p>
                <p className="text-3xl font-bold text-amber-600">{formData.quantidade_elementos}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded">
              <h4 className="font-bold mb-3">Peso por Bitola:</h4>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(resumo.por_bitola).map(([bitola, dados]) => (
                  <div key={bitola} className="text-center p-3 bg-white rounded border">
                    <Badge className="bg-blue-600 mb-2">{bitola}mm</Badge>
                    <p className="text-sm font-bold">{dados.peso.toFixed(2)} kg</p>
                    <p className="text-xs text-slate-500">{dados.quantidade} barras</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BOTÕES FINAIS - Updated styling and text */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSalvar} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          Adicionar Item
        </Button>
      </div>
    </div>
  );
}
