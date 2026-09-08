import { computeDashboardDerivedKpis } from '@/components/lib/dashboardKpiPolicy';

export default function useDashboardDerivedData(args = {}) {
  return computeDashboardDerivedKpis(args);
}
