import React from "react";
import ConfigCenter from "@/components/sistema/ConfigCenter";

import ProtectedSection from "@/components/security/ProtectedSection";

export default function IAPanel() {
  return (
    <div className="w-full h-full grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
      <div className="w-full min-h-[300px]">
        <ProtectedSection module="Sistema" section={["Configurações","IA"]} action="visualizar">
          <ConfigCenter />
        </ProtectedSection>
      </div>
    </div>
  );
}
