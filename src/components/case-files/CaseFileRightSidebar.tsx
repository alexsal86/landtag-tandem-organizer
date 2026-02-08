import { CaseFile } from "@/hooks/useCaseFiles";
import { CaseFileTask } from "@/hooks/useCaseFileDetails";
import { CaseFileCurrentStatus } from "./CaseFileCurrentStatus";
import { CaseFileNextSteps } from "./CaseFileNextSteps";
import { CaseFileRisksOpportunities } from "./CaseFileRisksOpportunities";

interface CaseFileRightSidebarProps {
  caseFile: CaseFile;
  tasks: CaseFileTask[];
  caseFileId: string;
  onUpdateCurrentStatus: (note: string) => Promise<boolean>;
  onUpdateRisksOpportunities: (data: { risks: string[]; opportunities: string[] }) => Promise<boolean>;
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onAddTask: (taskId: string, notes?: string, taskTitle?: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function CaseFileRightSidebar({
  caseFile,
  tasks,
  caseFileId,
  onUpdateCurrentStatus,
  onUpdateRisksOpportunities,
  onCompleteTask,
  onAddTask,
  onRefresh,
}: CaseFileRightSidebarProps) {
  return (
    <div className="space-y-4">
      <CaseFileCurrentStatus
        caseFile={caseFile}
        onUpdate={onUpdateCurrentStatus}
      />
      <CaseFileNextSteps
        tasks={tasks}
        caseFileId={caseFileId}
        onCompleteTask={onCompleteTask}
        onAddTask={onAddTask}
        onRefresh={onRefresh}
      />
      <CaseFileRisksOpportunities
        caseFile={caseFile}
        onUpdate={onUpdateRisksOpportunities}
      />
    </div>
  );
}
