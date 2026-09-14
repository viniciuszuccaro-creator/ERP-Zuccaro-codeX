import React, { useState } from "react";
import { FileSearch, Loader2, ShieldCheck } from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { readFiscalStagingManifestPayload } from "./conciliacaoFinanceiraUiPolicy";

export default function ConciliacaoFiscalManifestPanel({ canValidate, validContext, permission, groupId, empresaId }) {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  if (!canValidate) return null;

  const validateManifest = async () => {
    setIsValidating(true);
    setSummary(null);
    try {
      if (!validContext) throw new Error("Selecione a Empresa antes de validar o manifesto fiscal.");
      const { manifest, summary: localSummary } = await readFiscalStagingManifestPayload(file);
      const response = await base44.functions.invoke("solicitacoesAprovacao", {
        action: "validateFiscalStagingManifestContext",
        group_id: groupId,
        empresa_id: empresaId,
        scope_type: "empresa",
        manifest,
      });
      const verified = response?.data;
      if (verified?.context_verified !== true
        || verified?.operational_promotion_allowed !== false
        || verified?.batch_id !== localSummary.batchId
        || verified?.candidate_count !== localSummary.candidateCount) {
        throw new Error(verified?.error || "O backend não confirmou o contexto protegido do manifesto.");
      }
      setSummary({ ...localSummary, contextVerified: true });
      toast({ title: "Contexto fiscal validado", description: "Nenhum registro foi importado nesta validação." });
    } catch (error) {
      toast({ title: "Manifesto fiscal recusado", description: error.message, variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Card data-context-required="true">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSearch className="h-5 w-5" />
          Validar manifesto de staging fiscal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <Alert className="border-amber-300 bg-amber-50">
          <ShieldCheck className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            O manifesto é validado localmente e o vínculo protegido é confirmado no backend. Esta ação não cria solicitações nem promove notas fiscais.
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="manifesto-staging-fiscal">Manifesto JSON protegido</Label>
            <input
              id="manifesto-staging-fiscal"
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setSummary(null);
              }}
              className="block w-full text-sm"
              data-permission={permission}
              data-sensitive="true"
            />
          </div>
          <Button
            type="button"
            onClick={validateManifest}
            disabled={!file || isValidating || !validContext}
            data-permission={permission}
            data-action="conciliacao-fiscal-validar-manifesto"
            data-sensitive="true"
          >
            {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
            Validar manifesto
          </Button>
        </div>
        {summary && (
          <div className="grid gap-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm sm:grid-cols-3">
            <div><span className="block text-slate-600">Lote</span><strong>{summary.batchId}</strong></div>
            <div><span className="block text-slate-600">Candidatos</span><strong>{summary.candidateCount}</strong></div>
            <div><span className="block text-slate-600">Resultado</span><Badge className="bg-emerald-700">Contexto validado</Badge></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
