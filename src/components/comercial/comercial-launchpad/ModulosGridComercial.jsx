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
            return (
              <LaunchpadCard
                key={idx}
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
                disabled={blockedByProposal}
                disabledReason={
                  blockedByProposal
                    ? 'Proposta visual — abra apenas Orçamentos (sem módulos operacionais).'
                    : undefined
                }
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
