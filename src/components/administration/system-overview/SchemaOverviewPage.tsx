import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MermaidRenderer } from "@/components/administration/MermaidRenderer";

export type SchemaRow = Record<string, string>;

export interface SchemaTableSection {
  type: "table";
  title: string;
  description?: string;
  columns: { key: string; label: string; className?: string }[];
  rows: SchemaRow[];
}

export interface SchemaStateSection {
  type: "state";
  title: string;
  description?: string;
  states: string[];
  chart: string;
}

export interface SchemaDiagramSection {
  type: "diagram";
  subtype: "sequence" | "flowchart" | "state";
  title: string;
  description?: string;
  chart: string;
}

export interface SchemaCodeSection {
  type: "code";
  title: string;
  blocks: { heading: string; content: string }[];
}

export interface SchemaListSection {
  type: "list";
  title: string;
  items: string[];
}

export type SchemaSection = SchemaTableSection | SchemaStateSection | SchemaDiagramSection | SchemaCodeSection | SchemaListSection;

export interface SchemaOverviewProfile {
  id: string;
  title: string;
  description: string;
  sections: SchemaSection[];
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, "-")
    .replace(/^-+|-+$/g, "");

export function SchemaOverviewPage({ profile }: { profile: SchemaOverviewProfile }) {
  const sectionAnchors = profile.sections.map((section, index) => ({
    title: section.title,
    id: `${slugify(section.title)}-${index + 1}`,
  }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{profile.title}</CardTitle>
          <CardDescription>{profile.description}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schnellnavigation</CardTitle>
          <CardDescription>Direkt zu Abschnitten springen.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {sectionAnchors.map((anchor) => (
            <a
              key={anchor.id}
              href={`#${anchor.id}`}
              className="text-xs rounded-md border px-2 py-1 hover:bg-muted"
            >
              {anchor.title}
            </a>
          ))}
        </CardContent>
      </Card>

      {profile.sections.map((section, sectionIndex) => {
        const sectionId = sectionAnchors[sectionIndex]?.id;
        if (section.type === "table") {
          return (
            <Card key={section.title} id={sectionId}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                {section.description && <CardDescription>{section.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {section.columns.map((column) => (
                        <TableHead key={column.key} className={column.className}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.rows.map((row, rowIndex) => (
                      <TableRow key={`${section.title}-${rowIndex}`}>
                        {section.columns.map((column, columnIndex) => (
                          <TableCell key={`${column.key}-${rowIndex}`} className={columnIndex === 0 ? "font-medium" : undefined}>
                            {column.key === "source" || column.key === "location"
                              ? <code className="text-xs">{row[column.key]}</code>
                              : row[column.key]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        }

        if (section.type === "state") {
          return (
            <Card key={section.title} id={sectionId}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                {section.description && <CardDescription>{section.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {section.states.map((state) => (
                    <Badge key={state} variant="secondary">{state}</Badge>
                  ))}
                </div>
                <div className="rounded-md border bg-muted/40 p-4"><MermaidRenderer chart={section.chart} /></div>
              </CardContent>
            </Card>
          );
        }

        if (section.type === "code") {
          return (
            <Card key={section.title} id={sectionId}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.blocks.map((block, blockIndex) => (
                  <div key={block.heading}>
                    {blockIndex > 0 && <Separator className="mb-4" />}
                    <h4 className="font-medium mb-2">{block.heading}</h4>
                    <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto">{block.content}</pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        }

        if (section.type === "diagram") {
          return (
            <Card key={section.title} id={sectionId}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                {section.description && <CardDescription>{section.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline">{section.subtype}</Badge>
                <div className="rounded-md border bg-muted/40 p-4"><MermaidRenderer chart={section.chart} /></div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={section.title} id={sectionId}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              {section.items.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
