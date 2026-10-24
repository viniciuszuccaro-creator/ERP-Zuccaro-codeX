import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ruler } from 'lucide-react';

/**
 * Visualizador Gráfico de Peça
 * Desenha a peça com medidas sobrepostas
 */
export default function VisualizadorPeca({ posicao }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!posicao || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Limpar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar baseado no formato
    desenharPeca(ctx, posicao, canvas.width, canvas.height);
  }, [posicao]);

  const desenharPeca = (ctx, pos, width, height) => {
    const medidas = pos.medidas || {};
    const escala = 3; // pixels por cm
    const offsetX = 50;
    const offsetY = height - 50;

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.font = '14px Arial';
    ctx.fillStyle = '#1e40af';

    if (pos.formato === 'reto') {
      // Linha horizontal
      const comprimento = (medidas.A || 0) * escala;
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
      ctx.lineTo(offsetX + comprimento, offsetY);
      ctx.stroke();

      // Medida
      ctx.fillText(`A = ${medidas.A}cm`, offsetX + comprimento / 2 - 30, offsetY + 25);
    }

    if (pos.formato === 'L') {
      const A = (medidas.A || 0) * escala;
      const B = (medidas.B || 0) * escala;

      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
      ctx.lineTo(offsetX + A, offsetY);
      ctx.lineTo(offsetX + A, offsetY - B);
      ctx.stroke();

      // Medidas
      ctx.fillText(`A = ${medidas.A}cm`, offsetX + A / 2 - 30, offsetY + 25);
      ctx.fillText(`B = ${medidas.B}cm`, offsetX + A + 10, offsetY - B / 2);
    }

    if (pos.formato === 'U') {
      const A = (medidas.A || 0) * escala;
      const B = (medidas.B || 0) * escala;
      const C = (medidas.C || 0) * escala;

      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
      ctx.lineTo(offsetX, offsetY - A);
      ctx.lineTo(offsetX + B, offsetY - A);
      ctx.lineTo(offsetX + B, offsetY - A + C);
      ctx.stroke();

      // Medidas
      ctx.fillText(`A = ${medidas.A}cm`, offsetX - 40, offsetY - A / 2);
      ctx.fillText(`B = ${medidas.B}cm`, offsetX + B / 2 - 30, offsetY - A - 20);
      ctx.fillText(`C = ${medidas.C}cm`, offsetX + B + 10, offsetY - A + C / 2);
    }

    if (pos.formato === 'estribo') {
      const A = (medidas.A || 0) * escala;
      const B = (medidas.B || 0) * escala;

      // Retângulo
      ctx.beginPath();
      ctx.rect(offsetX, offsetY - B, A, B);
      ctx.stroke();

      // Medidas
      ctx.fillText(`A = ${medidas.A}cm`, offsetX + A / 2 - 30, offsetY + 20);
      ctx.fillText(`B = ${medidas.B}cm`, offsetX - 40, offsetY - B / 2);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Visualizador de Peça</h3>
          </div>
          {posicao && (
            <Badge className="bg-blue-600">
              {posicao.codigo}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        {posicao ? (
          <div className="space-y-4 w-full">
            <canvas
              ref={canvasRef}
              width={500}
              height={400}
              className="border-2 border-slate-300 rounded-lg bg-white w-full"
            />

            {/* Detalhes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-slate-600">Bitola</p>
                <p className="text-lg font-bold text-blue-600">{posicao.bitola}mm</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-slate-600">Quantidade</p>
                <p className="text-lg font-bold text-green-600">{posicao.quantidade}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-slate-600">Formato</p>
                <p className="text-lg font-bold text-sky-600">{posicao.formato}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-slate-600">Peso Total</p>
                <p className="text-lg font-bold text-orange-600">
                  {posicao.peso_kg?.toFixed(2)} kg
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400">
            <Ruler className="w-24 h-24 mx-auto mb-4 opacity-30" />
            <p>Selecione uma posição na planilha</p>
            <p className="text-sm mt-1">para visualizar o desenho</p>
          </div>
        )}
      </div>
    </div>
  );
}
