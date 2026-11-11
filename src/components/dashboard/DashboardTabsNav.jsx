import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, BarChart3 } from "lucide-react";

export default function DashboardTabsNav() {
  return (
    <TabsList className="bg-white border shadow-sm">
      <TabsTrigger value="tempo-real" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
        <Activity className="w-4 h-4 mr-2" />
        Tempo Real
      </TabsTrigger>
      <TabsTrigger value="resumo" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
        <BarChart3 className="w-4 h-4 mr-2" />
        Resumo Geral
      </TabsTrigger>
      <TabsTrigger value="bi-operacional" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
        🤖 BI Operacional
      </TabsTrigger>
    </TabsList>
  );
}
