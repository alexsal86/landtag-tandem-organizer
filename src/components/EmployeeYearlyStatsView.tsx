import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Thermometer } from "lucide-react";

interface YearlyStats {
  user_id: string;
  year: number;
  annual_vacation_days: number;
  used_vacation_days: number;
  carry_over_days: number;
  sick_days_count: number;
  display_name?: string;
}

interface EmployeeYearlyStatsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeYearlyStatsView({ isOpen, onClose }: EmployeeYearlyStatsViewProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<YearlyStats[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() - 1);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadAvailableYears();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedYear) {
      loadStats();
    }
  }, [isOpen, selectedYear]);

  const loadAvailableYears = async () => {
    try {
      const { data } = await supabase
        .from("employee_yearly_stats")
        .select("year")
        .order("year", { ascending: false });

      if (data) {
        const years = [...new Set(data.map(d => d.year))];
        setAvailableYears(years);
        if (years.length > 0 && !years.includes(selectedYear)) {
          setSelectedYear(years[0]);
        }
      }
    } catch (error) {
      console.error("Error loading years:", error);
    }
  };

  const loadStats = async () => {
    if (!currentTenant) return;
    setLoading(true);
    
    try {
      // Get yearly stats
      const { data: statsData, error: statsError } = await supabase
        .from("employee_yearly_stats")
        .select("*")
        .eq("year", selectedYear);

      if (statsError) throw statsError;

      // Get profile names
      const userIds = (statsData || []).map(s => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p.display_name])
      );

      const enrichedStats = (statsData || []).map(s => ({
        ...s,
        display_name: profileMap.get(s.user_id) || "Unbekannt",
      }));

      setStats(enrichedStats);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Jahresstatistik Mitarbeiter
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Jahr:</span>
            <select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {availableYears.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Keine Statistiken für {selectedYear} vorhanden</p>
              <p className="text-sm mt-1">
                Die Jahresstatistik wird am Ende eines Jahres automatisch archiviert.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Urlaubsanspruch
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Genommen</TableHead>
                  <TableHead className="text-center">Übertrag</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Thermometer className="h-4 w-4" />
                      Krankentage
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.user_id}>
                    <TableCell className="font-medium">
                      {stat.display_name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {stat.annual_vacation_days} Tage
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={stat.used_vacation_days > stat.annual_vacation_days ? "destructive" : "outline"}
                      >
                        {stat.used_vacation_days} Tage
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.carry_over_days > 0 ? (
                        <Badge variant="default">{stat.carry_over_days} Tage</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={stat.sick_days_count > 10 ? "destructive" : "secondary"}>
                        {stat.sick_days_count} Tage
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
