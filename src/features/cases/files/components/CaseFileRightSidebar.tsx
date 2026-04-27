import { CaseFile } from "@/features/cases/files/hooks";
import { CaseFileTask, CaseFileDocument } from "@/features/cases/files/hooks";
import { CaseFileCurrentStatus } from "./CaseFileCurrentStatus";
import { CaseFileNextSteps } from "./CaseFileNextSteps";
import { CaseFileRisksOpportunities } from "./CaseFileRisksOpportunities";
import { CaseFileDocumentsCard } from "./CaseFileDocumentsCard";

interface CaseFileRightSidebarProps {
  caseFile: CaseFile;
  tasks: CaseFileTask[];
  documents: CaseFileDocument[];
  caseFileId: string;
  onUpdateCurrentStatus: (note: string) => Promise<boolean>;
  onUpdateProcessingStatuses?: (statuses: string[]) => Promise<boolean>;
  onUpdateRisksOpportunities: (data: { risks: string[]; opportunities: string[] }) => Promise<boolean>;
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onAddTask: (taskId: string, notes?: string, taskTitle?: string) => Promise<boolean>;
  onAddDocument?: () => void;
  onRefresh: () => void;
}

export function CaseFileRightSidebar({
  caseFile,
  tasks,
  documents,
  caseFileId,
  onUpdateCurrentStatus,
  onUpdateProcessingStatuses,
  onUpdateRisksOpportunities,
  onCompleteTask,
  onAddTask,
  onAddDocument,
  onRefresh,
}: CaseFileRightSidebarProps) {
  return (
    <div className="space-y-4">
      <CaseFileCurrentStatus
        caseFile={caseFile}
        onUpdate={onUpdateCurrentStatus}
        onUpdateProcessingStatuses={onUpdateProcessingStatuses}
      />
      <CaseFileNextSteps
        tasks={tasks}
        caseFileId={caseFileId}
        tenantId={caseFile.tenant_id}
        caseFileTitle={caseFile.title}
        assignedTo={caseFile.assigned_to}
        onCompleteTask={onCompleteTask}
        onAddTask={onAddTask}
        onRefresh={onRefresh}
      />
      <CaseFileRisksOpportunities
        caseFile={caseFile}
        onUpdate={onUpdateRisksOpportunities}
      />
      <CaseFileDocumentsCard
        documents={documents}
        onAdd={onAddDocument}
      />
    </div>
  );
}
