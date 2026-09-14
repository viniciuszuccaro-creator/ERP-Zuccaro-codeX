import React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ConciliacaoManualWorkflowDialog({
  dialogState,
  domain,
  config,
  decision,
  onDecisionChange,
  justification,
  onJustificationChange,
  onEvidenceChange,
  humanConfirmed,
  onHumanConfirmedChange,
  reconcilePermission,
  approvePermission,
  isPending,
  onClose,
  onConfirm,
}) {
  const action = dialogState?.action;
  const isEvidence = action === "attachManualReconciliationEvidence";
  const isFinalApproval = action === "approveManualReconciliation";

  return (
    <Dialog open={Boolean(dialogState)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEvidence && "Anexar evidência"}
            {action === "reviewManualReconciliation" && `Revisão ${config.domainLabel}`}
            {isFinalApproval && "Aprovação final"}
          </DialogTitle>
        </DialogHeader>
        {isEvidence ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`evidencia-${domain}`}>Arquivo comprobatório</Label>
              <input
                id={`evidencia-${domain}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => onEvidenceChange(event.target.files?.[0] || null)}
                className="block w-full text-sm"
                data-permission={reconcilePermission}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao-evidencia">Descrição</Label>
              <Textarea
                id="descricao-evidencia"
                value={justification}
                onChange={(event) => onJustificationChange(event.target.value)}
                maxLength={500}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Decisão {config.domainLabel}</Label>
              <Select value={decision} onValueChange={onDecisionChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {config.decisions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificativa-conciliacao">Justificativa</Label>
              <Textarea
                id="justificativa-conciliacao"
                value={justification}
                onChange={(event) => onJustificationChange(event.target.value)}
                maxLength={1000}
              />
            </div>
            {isFinalApproval && (
              <div className="flex items-start gap-2 rounded border p-3">
                <Checkbox
                  id="confirmar-conciliacao"
                  checked={humanConfirmed}
                  onCheckedChange={(checked) => onHumanConfirmedChange(checked === true)}
                  data-permission={approvePermission}
                  data-action="conciliacao-confirmacao-humana"
                />
                <Label htmlFor="confirmar-conciliacao" className="leading-5">
                  Confirmo que revisei a evidência e que esta decisão não promove nenhum registro operacional.
                </Label>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || (isFinalApproval && !humanConfirmed)}
            data-permission={isFinalApproval ? approvePermission : reconcilePermission}
            data-action="conciliacao-confirmar-transicao"
            data-sensitive="true"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
