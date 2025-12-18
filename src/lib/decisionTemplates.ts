export interface ResponseOption {
  key: string;
  label: string;
  color: string;
  icon?: string;
  requires_comment?: boolean;
}

export interface DecisionTemplate {
  id: string;
  name: string;
  description: string;
  options: ResponseOption[];
}

export const DECISION_TEMPLATES: Record<string, DecisionTemplate> = {
  yesNoQuestion: {
    id: "yesNoQuestion",
    name: "Ja / Nein / Rückfrage",
    description: "Standard-Abstimmung mit Rückfrage-Option",
    options: [
      { key: "yes", label: "Ja", color: "green", icon: "check" },
      { key: "no", label: "Nein", color: "red", icon: "x" },
      { key: "question", label: "Rückfrage", color: "orange", icon: "message-circle", requires_comment: true }
    ]
  },
  yesNo: {
    id: "yesNo",
    name: "Ja / Nein",
    description: "Einfache Ja/Nein-Abstimmung",
    options: [
      { key: "yes", label: "Ja", color: "green", icon: "check" },
      { key: "no", label: "Nein", color: "red", icon: "x" }
    ]
  },
  rating5: {
    id: "rating5",
    name: "Bewertung 1-5",
    description: "Skala von 1 (schlecht) bis 5 (sehr gut)",
    options: [
      { key: "1", label: "1", color: "red" },
      { key: "2", label: "2", color: "orange" },
      { key: "3", label: "3", color: "yellow" },
      { key: "4", label: "4", color: "lime" },
      { key: "5", label: "5", color: "green" }
    ]
  },
  optionABC: {
    id: "optionABC",
    name: "Option A / B / C",
    description: "Drei alternative Vorschläge",
    options: [
      { key: "a", label: "Option A", color: "blue" },
      { key: "b", label: "Option B", color: "purple" },
      { key: "c", label: "Option C", color: "gray" }
    ]
  },
  custom: {
    id: "custom",
    name: "Benutzerdefiniert",
    description: "Eigene Antwortoptionen erstellen",
    options: []
  }
};

export const DEFAULT_TEMPLATE_ID = "yesNoQuestion";

export const getTemplateById = (id: string): DecisionTemplate | undefined => {
  return DECISION_TEMPLATES[id];
};

export const getDefaultOptions = (): ResponseOption[] => {
  return DECISION_TEMPLATES.yesNoQuestion.options;
};

// Color mappings for Tailwind classes
export const COLOR_OPTIONS = [
  { value: "green", label: "Grün", bgClass: "bg-green-100", textClass: "text-green-700", borderClass: "border-green-600" },
  { value: "red", label: "Rot", bgClass: "bg-red-100", textClass: "text-red-700", borderClass: "border-red-600" },
  { value: "orange", label: "Orange", bgClass: "bg-orange-100", textClass: "text-orange-700", borderClass: "border-orange-600" },
  { value: "yellow", label: "Gelb", bgClass: "bg-yellow-100", textClass: "text-yellow-700", borderClass: "border-yellow-600" },
  { value: "blue", label: "Blau", bgClass: "bg-blue-100", textClass: "text-blue-700", borderClass: "border-blue-600" },
  { value: "purple", label: "Lila", bgClass: "bg-purple-100", textClass: "text-purple-700", borderClass: "border-purple-600" },
  { value: "lime", label: "Hellgrün", bgClass: "bg-lime-100", textClass: "text-lime-700", borderClass: "border-lime-600" },
  { value: "gray", label: "Grau", bgClass: "bg-gray-100", textClass: "text-gray-700", borderClass: "border-gray-600" },
];

export const getColorClasses = (color: string) => {
  const colorOption = COLOR_OPTIONS.find(c => c.value === color);
  return colorOption || COLOR_OPTIONS[0];
};
