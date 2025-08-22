import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Euro, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ExpenseWidgetProps {
  className?: string;
}

export const ExpenseWidget = ({ className }: ExpenseWidgetProps) => {
  const { user } = useAuth();
  const [currentMonthTotal, setCurrentMonthTotal] = useState(0);
  const [currentBudget, setCurrentBudget] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadExpenseData();
    }
  }, [user]);

  const loadExpenseData = async () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

    // Load current month expenses
    const { data: expenses } = await supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate);

    // Load current month budget
    const { data: budget } = await supabase
      .from("expense_budgets")
      .select("budget_amount")
      .eq("user_id", user?.id)
      .eq("year", year)
      .eq("month", month)
      .single();

    const total = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
    setCurrentMonthTotal(total);
    setCurrentBudget(budget?.budget_amount || 0);
    setLoading(false);
  };

  const balance = currentBudget - currentMonthTotal;
  const usagePercent = currentBudget > 0 ? (currentMonthTotal / currentBudget) * 100 : 0;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Monatsbudget</CardTitle>
        <Euro className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {currentMonthTotal.toFixed(2)} €
          </div>
          <div className="text-xs text-muted-foreground">
            von {currentBudget.toFixed(2)} € Budget
          </div>
          <div className="flex items-center gap-2">
            {balance >= 0 ? (
              <TrendingDown className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingUp className="h-3 w-3 text-red-600" />
            )}
            <span className={`text-xs font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(balance).toFixed(2)} € {balance >= 0 ? 'übrig' : 'überschritten'}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                usagePercent > 100 ? 'bg-red-500' : usagePercent > 80 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {usagePercent.toFixed(1)}% verbraucht
          </div>
        </div>
      </CardContent>
    </Card>
  );
};