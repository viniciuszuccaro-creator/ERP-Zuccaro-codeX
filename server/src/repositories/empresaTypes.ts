import type { TenantScope } from '../audit/types.js';

export type Empresa = {
  id: string;
  group_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EmpresaCreateInput = {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  status?: string;
};

/**
 * Interface desacoplada — implementacao Postgres em lotes futuros de cadastro.
 * RUNTIME-01 expoe o contrato para nao espalhar SQL no frontend.
 */
export interface EmpresaRepository {
  list(scope: TenantScope): Promise<Empresa[]>;
  getById(scope: TenantScope, id: string): Promise<Empresa | null>;
  create(scope: TenantScope, data: EmpresaCreateInput): Promise<Empresa>;
}
