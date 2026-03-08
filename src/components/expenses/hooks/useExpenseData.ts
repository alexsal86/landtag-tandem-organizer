import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  order_index: number;
}

export interface Expense {
  id: string;
  amount: number;
  expense_date: string;
  description: string | null;
  notes: string | null;
  receipt_file_path: string | null;
  category_id: string;
  category?: ExpenseCategory;
  recurring_type: string;
}

export interface ExpenseBudget {
  id: string;
  year: number;
  month: number;
  budget_amount: number;
}

export function useExpenseData() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user && currentTenant) {
      loadCategories();
      loadExpenses();
      loadBudgets();
    }
  }, [user, currentTenant, selectedMonth, selectedYear]);

  const loadCategories = async () => {
    if (!currentTenant) return;
    const { data, error } = await supabase.from("expense_categories").select("*").eq("tenant_id", currentTenant.id).eq("is_active", true).order("order_index");
    if (error) toast({ title: "Fehler", description: "Kategorien konnten nicht geladen werden", variant: "destructive" });
    else setCategories(data || []);
  };

  const loadExpenses = async () => {
    if (!currentTenant) return;
    const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    const { data, error } = await supabase.from("expenses").select(`*, category:expense_categories(*)`).eq("tenant_id", currentTenant.id).gte("expense_date", startDate).lte("expense_date", endDate).order("expense_date", { ascending: false });
    if (error) toast({ title: "Fehler", description: "Ausgaben konnten nicht geladen werden", variant: "destructive" });
    else setExpenses((data as Expense[]) || []);
  };

  const loadBudgets = async () => {
    if (!user || !currentTenant) return;
    const { data, error } = await supabase.from("expense_budgets").select("*").eq("user_id", user.id).eq("tenant_id", currentTenant.id).order("year", { ascending: false }).order("month", { ascending: false });
    if (error) toast({ title: "Fehler", description: "Budgets konnten nicht geladen werden", variant: "destructive" });
    else setBudgets(data || []);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user?.id}/receipts/${fileName}`;
    const { error } = await supabase.storage.from('documents').upload(filePath, file);
    if (error) { toast({ title: "Fehler", description: `Beleg konnte nicht hochgeladen werden: ${error.message}`, variant: "destructive" }); return null; }
    return filePath;
  };

  const addExpense = async (newExpense: { amount: string; expense_date: string; description: string; notes: string; category_id: string; receipt_file: File | null; recurring_type: string }) => {
    if (!newExpense.amount || !newExpense.category_id) { toast({ title: "Fehler", description: "Betrag und Kategorie sind erforderlich", variant: "destructive" }); return false; }
    let receiptPath = null;
    if (newExpense.receipt_file) { receiptPath = await uploadReceipt(newExpense.receipt_file); if (!receiptPath) return false; }
    const { error } = await supabase.from("expenses").insert([{ user_id: user?.id, tenant_id: currentTenant?.id, amount: parseFloat(newExpense.amount), expense_date: newExpense.expense_date, description: newExpense.description || null, notes: newExpense.notes || null, receipt_file_path: receiptPath, category_id: newExpense.category_id, recurring_type: newExpense.recurring_type }]);
    if (error) { toast({ title: "Fehler", description: "Ausgabe konnte nicht hinzugefügt werden", variant: "destructive" }); return false; }
    toast({ title: "Erfolg", description: "Ausgabe wurde hinzugefügt" }); loadExpenses(); return true;
  };

  const addCategory = async (newCategory: { name: string; description: string; color: string }) => {
    if (!newCategory.name) { toast({ title: "Fehler", description: "Name ist erforderlich", variant: "destructive" }); return false; }
    const { error } = await supabase.from("expense_categories").insert({ name: newCategory.name, description: newCategory.description || null, color: newCategory.color, order_index: categories.length, tenant_id: currentTenant?.id });
    if (error) { toast({ title: "Fehler", description: "Kategorie konnte nicht hinzugefügt werden", variant: "destructive" }); return false; }
    toast({ title: "Erfolg", description: "Kategorie wurde hinzugefügt" }); loadCategories(); return true;
  };

  const setBudgetAmount = async (amount: string) => {
    if (!amount) { toast({ title: "Fehler", description: "Budget-Betrag ist erforderlich", variant: "destructive" }); return false; }
    const parsedAmount = parseFloat(amount);
    const { error } = await supabase.from("expense_budgets").upsert({ user_id: user?.id, tenant_id: currentTenant?.id, year: selectedYear, month: selectedMonth, budget_amount: parsedAmount });
    if (error) { toast({ title: "Fehler", description: "Budget konnte nicht gesetzt werden", variant: "destructive" }); return false; }
    const currentDate = new Date(selectedYear, selectedMonth - 1);
    const futureMonths = [];
    for (let i = 1; i <= 12; i++) {
      const futureDate = new Date(currentDate); futureDate.setMonth(futureDate.getMonth() + i);
      const year = futureDate.getFullYear(); const month = futureDate.getMonth() + 1;
      if (!budgets.find(b => b.year === year && b.month === month)) futureMonths.push({ user_id: user?.id, tenant_id: currentTenant?.id, year, month, budget_amount: parsedAmount });
    }
    if (futureMonths.length > 0) await supabase.from("expense_budgets").insert(futureMonths);
    toast({ title: "Erfolg", description: `Budget wurde gesetzt und auf ${futureMonths.length} weitere Monate angewendet` }); loadBudgets(); return true;
  };

  const getCurrentBudget = () => budgets.find(b => b.year === selectedYear && b.month === selectedMonth);
  const getTotalExpenses = () => expenses.reduce((sum, e) => sum + e.amount, 0);
  const getBalance = () => (getCurrentBudget()?.budget_amount || 0) - getTotalExpenses();
  const getCategoryExpenses = () => {
    const map = new Map<string, { total: number; color: string }>();
    expenses.forEach(e => { const n = e.category?.name || "Unbekannt"; const c = e.category?.color || "#6b7280"; const cur = map.get(n) || { total: 0, color: c }; map.set(n, { total: cur.total + e.amount, color: c }); });
    return Array.from(map.entries()).map(([name, data]) => ({ name, total: data.total, color: data.color }));
  };

  const exportToCSV = () => {
    const headers = ['Datum', 'Beschreibung', 'Kategorie', 'Betrag', 'Hinweise'];
    const csvData = expenses.map(e => [format(new Date(e.expense_date), "dd.MM.yyyy"), e.description || '', e.category?.name || 'Unbekannt', e.amount.toFixed(2), e.notes || '']);
    const csvContent = [headers.join(','), ...csvData.map(row => row.map(f => `"${f}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `ausgaben-${selectedYear}-${selectedMonth.toString().padStart(2, '0')}.csv`; link.click();
  };

  return {
    categories, expenses, budgets, selectedMonth, selectedYear,
    setSelectedMonth, setSelectedYear,
    addExpense, addCategory, setBudgetAmount, exportToCSV,
    getCurrentBudget, getTotalExpenses, getBalance, getCategoryExpenses,
  };
}
