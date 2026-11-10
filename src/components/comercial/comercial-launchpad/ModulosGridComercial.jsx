import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import LaunchpadCard from '../../financeiro/LaunchpadCard';

function isOrcamentosModule(module) {
  return /or[cç]amento/i.test(String(module?.title || ''))
    || /or[cç]amento/i.test(String(module?.sectionKey || ''));
}

export default function ModulosGridComercial({ modules, onModuleClick, proposalMode = false }) {
  return (
    <Card className="border-0 shadow-sm flex-1" data-proposta-grid={proposalMode ? 'comercial360' : undefined}>
      <CardContent className="p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {modules.map((module, idx) => {
            const blockedByProposal = proposalMode && !isOrcamentosModule(module);
            const liberatedByProposal = proposalMode && isOrcamentosModule(module);
            return (
              <div
                key={idx}
                className={
                  blockedByProposal
                    ? 'opacity-40 grayscale relative cursor-not-allowed'
                    : liberatedByProposal
                      ? 'relative ring-2 ring-sky-400 rounded-md'
                      : undefined
                }
                data-proposta-card={
                  blockedByProposal ? 'bloqueado' : liberatedByProposal ? 'liberado' : undefined
                }
                aria-disabled={blockedByProposal || undefined}
                title={
                  blockedByProposal
                    ? 'Proposta visual — abra apenas Orçamentos (sem módulos operacionais).'
                    : liberatedByProposal
                      ? 'Proposta visual — Orçamentos sintéticos (única entrada liberada).'
                      : undefined
                }
                onClickCapture={blockedByProposal ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onModuleClick(module);
                } : undefined}
                onKeyDownCapture={blockedByProposal ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onModuleClick(module);
                  }
                } : undefined}
              >
                <LaunchpadCard
                  title={module.title}
                  description={
                    blockedByProposal
                      ? 'Proposta visual — só Orçamentos (sem módulos operacionais).'
                      : module.description
                  }
                  icon={module.icon}
                  onClick={() => onModuleClick(module)}
                  color={module.color}
                  badge={blockedByProposal ? 'Proposta' : module.badge}
                  dataPermission={module.permissionKey}
                  dataAction={
                    blockedByProposal
                      ? 'proposta-modulo-bloqueado'
                      : `Comercial.${module.sectionKey || module.title}.abrir`
                  }
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
