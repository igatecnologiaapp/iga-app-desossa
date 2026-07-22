import { useUserContext } from "./use-auth";

export function usePermissions() {
  const { context, isLoading } = useUserContext();
  const isAdmin = !!context?.isAdmin;
  const isSupervisor = !!context?.isSupervisor;
  const isAcougueiro = !!context?.isAcougueiro;
  const isVisualizacao = !!context?.isVisualizacao;
  const isReadOnly = isVisualizacao && !isAdmin && !isSupervisor;

  return {
    isLoading,
    context,
    isAdmin,
    isSupervisor,
    isAcougueiro,
    isVisualizacao,
    isReadOnly,
    canManageUsers: isAdmin,
    canManageSettings: isAdmin,
    canManageCadastros: isAdmin,
    canCreateOrders: isAdmin || isSupervisor,
    canEditOrders: isAdmin || isSupervisor,
    canCancelOrders: isAdmin || isSupervisor,
    canReopenOrders: isAdmin || isSupervisor,
    canDeleteOrders: isAdmin,
    canExecuteDesossa: isAdmin || isAcougueiro,
    canViewDashboard: isAdmin || isSupervisor || isVisualizacao,
    canViewReports: isAdmin || isSupervisor || isVisualizacao,
  };
}
