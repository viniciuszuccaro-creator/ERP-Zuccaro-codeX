import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import LaunchpadCard from "../../financeiro/LaunchpadCard";

export default function ModulosGridProducao({ modules, onModuleClick }) {
  return (
    <Card className="border-0 shadow-sm flex-1" data-permission="Producao.visualizar" data-context-required="true">
      <CardContent className="p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {modules.map((module, idx) => (
            <LaunchpadCard
              key={idx}
              title={module.title}
              description={module.description}
              icon={module.icon}
              onClick={() => onModuleClick(module)}
              color={module.color}
              badge={module.badge}
              dataPermission={module.permission || `Producao.${module.title}.visualizar`}
              dataAction={module.action || `abrir-producao-${module.title.toLowerCase().replace(/\s+/g, '-')}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
