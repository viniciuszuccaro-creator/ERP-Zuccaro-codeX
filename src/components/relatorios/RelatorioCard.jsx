import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export default function RelatorioCard({
  title,
  description,
  Icon,
  colorClass = "text-slate-600",
  badgeText,
  onClick,
}) {
  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" data-permission="Relatorios.visualizar" data-action="Relatorios.visualizar_card" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-slate-50`}>
            {Icon ? <Icon className={`w-6 h-6 ${colorClass}`} /> : null}
          </div>
          {badgeText ? (
            <Badge variant="outline" className="text-xs">{badgeText}</Badge>
          ) : null}
        </div>
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        {description ? (
          <p className="text-sm text-slate-600 mb-4">{description}</p>
        ) : null}
        <Button className="w-full" variant="outline" size="sm" data-permission="Relatorios.visualizar" data-action="Relatorios.visualizar">
          <Eye className="w-4 h-4 mr-2" />
          Visualizar
        </Button>
      </CardContent>
    </Card>
  );
}
