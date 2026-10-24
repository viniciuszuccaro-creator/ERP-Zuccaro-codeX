import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export default function PedidoTabsNav({ abas = [], activeTab, setActiveTab }) {
  return (
    <TabsList className="flex-shrink-0 bg-white border-b px-6 py-0 h-auto rounded-none flex-wrap justify-start">
      {abas.map((aba) => {
        const Icon = aba.icon;
        return (
          <TabsTrigger
            key={aba.id}
            value={aba.id}
            onClick={() => setActiveTab?.(aba.id)}
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white relative px-4 py-3"
          >
            {Icon && <Icon className="w-4 h-4 mr-2" />}
            {aba.label}
            {aba.novo && (
              <Badge className="ml-2 bg-sky-600 text-xs">NOVO</Badge>
            )}
            {aba.valido && <Check className="w-4 h-4 ml-2 text-green-600" />}
            {aba.count > 0 && (
              <Badge className="ml-2 bg-orange-600 text-xs">{aba.count}</Badge>
            )}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
