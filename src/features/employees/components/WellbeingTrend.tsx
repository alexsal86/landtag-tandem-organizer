import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getWellbeingTrend, type WellbeingPoint } from "../wellbeing";

export function WellbeingTrend({ meetings }: { meetings: WellbeingPoint[] }) {
  const trend = getWellbeingTrend(meetings);
  if (!trend.points.length) return null;
  return <Card><CardHeader><CardTitle>Belastung &amp; Befinden im Verlauf</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Zur gemeinsamen Reflexion und Unterstützung. Sichtbar nur für Sie und Ihre direkte Führungskraft.</p>
      <div className="h-56" role="img" aria-label="Verlauf von Zufriedenheit, Belastung und Balance auf einer Skala von 1 bis 5">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={trend.points}>
          <XAxis dataKey="meeting_date" tickFormatter={value => new Date(String(value)).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} /><Tooltip labelFormatter={value => new Date(String(value)).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} /><Legend />
          <Line dataKey="mood" name="Zufriedenheit" stroke="#2563eb" connectNulls={false} />
          <Line dataKey="workload" name="Belastung" stroke="#d97706" connectNulls={false} />
          <Line dataKey="balance" name="Balance" stroke="#16a34a" connectNulls={false} />
        </LineChart></ResponsiveContainer>
      </div>
      <table className="sr-only"><caption>Bewertungen je Gespräch</caption><thead><tr><th>Datum</th><th>Zufriedenheit</th><th>Belastung</th><th>Balance</th></tr></thead><tbody>{trend.points.map(p => <tr key={p.id}><td>{p.meeting_date}</td><td>{p.mood ?? "Keine Angabe"}</td><td>{p.workload ?? "Keine Angabe"}</td><td>{p.balance ?? "Keine Angabe"}</td></tr>)}</tbody></table>
      {trend.needsConversation && <p className="text-sm" role="status">Gesprächsimpuls: {trend.sustainedWorkload ? "Die Belastung war wiederholt hoch. " : ""}{trend.falling ? "Zufriedenheit oder Balance sind zuletzt gesunken." : ""}</p>}
    </CardContent>
  </Card>;
}
