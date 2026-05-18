import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

export default function RelatoriosFiltrosGlobais({ filtros, setFiltros }) {
  return (
    <Card className="border-0 shadow-md" data-permission="Relatorios.visualizar">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label htmlFor="data_inicio">Data Início</Label>
            <Input
              id="data_inicio"
              type="date"
              data-permission="Relatorios.visualizar"
              data-action="Relatorios.filtro.data_inicio"
              value={filtros.data_inicio}
              onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="data_fim">Data Fim</Label>
            <Input
              id="data_fim"
              type="date"
              data-permission="Relatorios.visualizar"
              data-action="Relatorios.filtro.data_fim"
              value={filtros.data_fim}
              onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value })}
            />
          </div>
          <div>
            <Label>Período Rápido</Label>
            <Select
              value={filtros.periodo}
              onValueChange={(value) => {
                const hoje = new Date();
                let inicio = new Date();
                switch (value) {
                  case 'hoje':
                    inicio = hoje; break;
                  case 'semana':
                    inicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000); break;
                  case 'mes':
                    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); break;
                  case 'trimestre':
                    inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1); break;
                  case 'ano':
                    inicio = new Date(hoje.getFullYear(), 0, 1); break;
                }
                setFiltros({
                  ...filtros,
                  periodo: value,
                  data_inicio: inicio.toISOString().split('T')[0],
                  data_fim: hoje.toISOString().split('T')[0],
                });
              }}
            >
              <SelectTrigger className="w-40" data-permission="Relatorios.visualizar" data-action="Relatorios.filtro.periodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Última Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="trimestre">Último Trimestre</SelectItem>
                <SelectItem value="ano">Este Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" data-permission="Relatorios.visualizar" data-action="Relatorios.aplicar_filtros">
            <Filter className="w-4 h-4 mr-2" />
            Aplicar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
