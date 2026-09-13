import React from "react";
import { AlertCircle, DollarSign, Shield, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CentralAprovacoesShell({ windowMode, contextoValido, acessoPermitido, children }) {
  const containerClass = windowMode
    ? "w-full h-full flex flex-col overflow-hidden"
    : "w-full h-full space-y-6";
  const contentClass = windowMode ? "flex-1 overflow-y-auto p-6" : "";

  return (
    <div className={containerClass} data-context-required="true">
      <div className={contentClass}>
        {(!contextoValido || !acessoPermitido) && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <Shield className="h-4 w-4 text-red-600" />
            <AlertDescription>
              <p className="font-semibold text-red-900">Acesso negado</p>
              <p className="mt-1 text-sm text-red-700">
                Selecione um contexto válido e confirme as permissões do seu perfil para acessar esta central.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <ShieldCheck className="h-7 w-7 text-orange-600" />
              Central de Aprovações V21.6
            </h2>
            <p className="text-sm text-slate-600">Gerencie aprovações com fechamento automático integrado</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

export function AprovacoesPlaceholder({ tipo }) {
  const limite = tipo === "limite";
  const Icon = limite ? DollarSign : AlertCircle;
  return (
    <Card className="mt-4 border-0 shadow-md">
      <CardHeader className={limite ? "border-b bg-purple-50" : "border-b bg-red-50"}>
        <CardTitle className="flex items-center gap-2">
          <Icon className={limite ? "h-5 w-5 text-purple-600" : "h-5 w-5 text-red-600"} />
          {limite ? "Aprovações de Limite de Crédito" : "Aprovações de Duplicatas Vencidas"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 text-slate-600">
        <p>Funcionalidade em desenvolvimento.</p>
      </CardContent>
    </Card>
  );
}
