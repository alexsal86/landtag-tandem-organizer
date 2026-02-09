import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DollarSign, Plus, ExternalLink, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ExpenseCategory {
  id: string;
  name: string;
  color: string | null;
}

interface RecentExpense {
  id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  category_name: string;
  category_color: string | null;
}

interface Props {
  userRole: string;
}

export function MyWorkExpenseWidget({ userRole }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [monthTotal, setMonthTotal] = useState(0);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [topCategories, setTopCategories] = useState<{ name: string; color: string | null; total: number }[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Quick entry dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && currentTenant) loadData();
  }, [user, currentTenant]);

  const loadData = async () => {
    if (!user || !currentTenant) return;
    setLoading(true);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    const [expensesRes, budgetRes, categoriesRes, recentRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount, category_id")
        .eq("tenant_id", currentTenant.id)
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd),
      supabase
        .from("expense_budgets")
        .select("budget_amount")
        .eq("tenant_id", currentTenant.id)
        .eq("year", now.getFullYear())
        .eq("month", now.getMonth() + 1)
        .maybeSingle(),
      supabase
        .from("expense_categories")
        .select("id, name, color")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true)
        .order("order_index"),
      supabase
        .from("expenses")
        .select("id, amount, description, expense_date, category_id")
        .eq("tenant_id", currentTenant.id)
        .order("expense_date", { ascending: false })
        .limit(5),
    ]);

    const cats = categoriesRes.data || [];
    setCategories(cats);
    const catMap = new Map(cats.map(c => [c.id, c]));

    // Monthly total & top categories
    const expenses = expensesRes.data || [];
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    setMonthTotal(total);
    setBudgetAmount(budgetRes.data?.budget_amount || 0);

    // Aggregate by category
    const catTotals: Record<string, number> = {};
    expenses.forEach(e => {
      catTotals[e.category_id] = (catTotals[e.category_id] || 0) + e.amount;
    });
    const sorted = Object.entries(catTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([catId, catTotal]) => ({
        name: catMap.get(catId)?.name || "Unbekannt",
        color: catMap.get(catId)?.color || null,
        total: catTotal,
      }));
    setTopCategories(sorted);

    // Recent expenses
    setRecentExpenses(
      (recentRes.data || []).map(e => ({
        id: e.id,
        amount: e.amount,
        description: e.description,
        expense_date: e.expense_date,
        category_name: catMap.get(e.category_id)?.name || "–",
        category_color: catMap.get(e.category_id)?.color || null,
      }))
    );

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !currentTenant || !newAmount || !newCategoryId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        tenant_id: currentTenant.id,
        amount: parseFloat(newAmount),
        category_id: newCategoryId,
        description: newDescription || null,
        expense_date: newDate,
      });
      if (error) throw error;
      toast({ title: "Ausgabe erfasst" });
      setDialogOpen(false);
      setNewAmount("");
      setNewCategoryId("");
      setNewDescription("");
      setNewDate(format(new Date(), "yyyy-MM-dd"));
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-6 bg-muted animate-pulse rounded" />
        <div className="h-20 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const budgetPercent = budgetAmount > 0 ? Math.min((monthTotal / budgetAmount) * 100, 100) : 0;
  const monthName = format(new Date(), "MMMM yyyy", { locale: de });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Kosten-Überblick
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Erfassen
          </Button>
          {userRole === "bueroleitung" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin?section=security&sub=expense")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Verwaltung
            </Button>
          )}
        </div>
      </div>

      {/* Monthly budget progress */}
      <div className="p-3 rounded-lg border bg-card space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{monthName}</span>
          <span className="font-medium">
            {monthTotal.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            {budgetAmount > 0 && (
              <span className="text-muted-foreground">
                {" "}/ {budgetAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </span>
            )}
          </span>
        </div>
        {budgetAmount > 0 && (
          <Progress value={budgetPercent} className="h-2" />
        )}

        {/* Top categories */}
        {topCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {topCategories.map((cat) => (
              <Badge
                key={cat.name}
                variant="secondary"
                className="text-xs"
                style={cat.color ? { borderColor: cat.color, borderWidth: 1 } : undefined}
              >
                {cat.name}: {cat.total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Recent expenses */}
      {recentExpenses.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Letzte Ausgaben</p>
          {recentExpenses.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: exp.category_color || "hsl(var(--muted-foreground))" }}
                />
                <span className="truncate">{exp.description || exp.category_name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(exp.expense_date), "dd.MM.", { locale: de })}
                </span>
                <span className="font-medium">
                  {exp.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick entry dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Ausgabe erfassen</h3>
          <div className="space-y-3">
            <div>
              <Label>Betrag (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Beschreibung (optional)</Label>
              <Textarea
                placeholder="Kurze Beschreibung..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !newAmount || !newCategoryId}>
              {submitting ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
