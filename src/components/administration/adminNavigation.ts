import { adminMenuItems } from "./AdminSidebar";

const DEFAULT_SUB_SECTION: Record<string, string> = {
  security: "general",
  personal: "matrix",
  finance: "expense",
  users: "status",
  calendar: "config",
  content: "topics",
  templates: "letters",
  politics: "associations",
  automation: "rules",
  superadmin: "tenants",
};

export const resolveNavigationState = (
  section: string | null,
  subSection: string | null,
  isSuperAdmin: boolean,
) : { section: string; subSection: string } => {
  // Preserve saved links when moving personal and financial settings.
  if (section === "security" && subSection === "expense") section = "finance";
  if ((section === "users" && subSection === "matrix") || (section === "content" && subSection === "archiving") || (section === "templates" && subSection === "celebrations")) section = "personal";
  const visibleSections = adminMenuItems.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const fallbackSection = visibleSections[0]?.id ?? "security";
  const matchedSection = visibleSections.find((item) => item.id === section) ??
    visibleSections.find((item) => item.id === fallbackSection);

  const nextSection = matchedSection?.id ?? "security";
  const visibleSubSections = matchedSection?.children?.filter((child) => !child.superAdminOnly || isSuperAdmin) ?? [];
  const fallbackSubSection =
    visibleSubSections.find((child) => child.id === DEFAULT_SUB_SECTION[nextSection])?.id ??
    visibleSubSections[0]?.id ??
    "";
  const nextSubSection = visibleSubSections.find((child) => child.id === subSection)?.id ?? fallbackSubSection;

  return { section: nextSection, subSection: nextSubSection };
};
