export const PRESS_EMAIL_TEMPLATE_SUBJECT_DEFAULT = "Pressemitteilung: {{titel}}";

export const PRESS_EMAIL_TEMPLATE_BODY_DEFAULT =
  "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere aktuelle Pressemitteilung:\n\n{{titel}}\n\n{{excerpt}}\n\n{{inhalt}}\n\nDen vollständigen Beitrag finden Sie unter:\n{{link}}";

export const PRESS_EMAIL_TEMPLATE_CORE_VARIABLES = ["{{titel}}", "{{inhalt}}"];

export const hasPressEmailTemplateCoreVariable = (template: string) =>
  PRESS_EMAIL_TEMPLATE_CORE_VARIABLES.some((variable) => template.includes(variable));
