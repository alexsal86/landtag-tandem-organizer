import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";

type WorkspaceView = "abgeordneter" | "mitarbeiter";

const WorkspaceViewContext = createContext<{
  view: WorkspaceView | undefined;
  setView: (view: WorkspaceView) => void;
} | null>(null);

export function WorkspaceViewProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const [selection, setSelection] = useState<{ userId: string; view: WorkspaceView }>();

  const setView = (view: WorkspaceView) => {
    if (userId) setSelection({ userId, view });
  };

  return (
    <WorkspaceViewContext.Provider value={{
      view: userId === selection?.userId ? selection?.view : undefined,
      setView,
    }}>
      {children}
    </WorkspaceViewContext.Provider>
  );
}

export function useWorkspaceView() {
  const preview = useContext(WorkspaceViewContext);
  const { isAbgeordneter, isEmployee, loading } = useResolvedUserRole();

  return {
    isDeputyView: preview?.view ? preview.view === "abgeordneter" : isAbgeordneter,
    isEmployeeView: preview?.view ? preview.view === "mitarbeiter" : isEmployee,
    loading: !preview?.view && loading,
    setView: preview?.setView,
  };
}
