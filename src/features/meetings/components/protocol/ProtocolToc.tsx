export function ProtocolToc({
  sections,
  activeSection,
}: {
  sections: { id: string; label: string }[];
  activeSection: string;
}) {
  return (
    <nav
      aria-label="Protokoll-Inhalt"
      className="sticky top-5 hidden min-[860px]:block text-sm print:!hidden"
    >
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Inhalt</p>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={activeSection === section.id ? "location" : undefined}
          className={`block border-l-2 px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeSection === section.id ? "border-primary font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
