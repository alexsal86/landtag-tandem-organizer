import defaults from "./defaultTemplates.json";
import {
  defaultStepSetting,
  type RoutineStepSetting,
} from "@/features/automation/routineWorkflow";
import { defaultHrMeta, type HrStepMeta } from "./progress";
export interface HrTemplateStep extends HrStepMeta {
  title: string;
  kind: "task" | "subtask";
  release: "package_start" | "scheduled";
}
export const HR_DEFAULT_TEMPLATES = defaults as Array<{
  employment_type: string;
  direction: "onboarding" | "offboarding";
  name: string;
  steps: HrTemplateStep[];
}>;
export function hrEditorFields(steps: HrTemplateStep[]) {
  return {
    value: steps.map((s) => `0 | ${s.title}`).join("\n"),
    kinds: JSON.stringify(steps.map((s) => s.kind)),
    settings: JSON.stringify(
      steps.map((s) => ({
        ...defaultStepSetting(),
        release: s.release,
        use_deputy: false,
      })),
    ),
    metadata: steps.map(
      ({ phase, is_mandatory, anchor, offset_days, evidence }) => ({
        phase,
        is_mandatory,
        anchor,
        offset_days,
        evidence,
      }),
    ),
  };
}
export function hrStepsFromEditor(
  value: string,
  kinds: string,
  settings: string,
  metadata: HrStepMeta[],
): HrTemplateStep[] {
  const types = JSON.parse(kinds) as HrTemplateStep["kind"][];
  const config = JSON.parse(settings) as RoutineStepSetting[];
  return value
    .split("\n")
    .filter((l) => l.trim())
    .map((line, i) => ({
      ...defaultHrMeta(),
      ...metadata[i],
      title: line.slice(line.indexOf("|") + 1).trim(),
      kind: types[i],
      release: config[i].release as HrTemplateStep["release"],
    }));
}
