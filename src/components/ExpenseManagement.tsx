import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Euro, TrendingUp, Calendar, Upload, Download, FileImage, Repeat, List, PieChart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip, Legend, Pie } from 'recharts';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  order_index: number;
}

interface Expense {
  id: string;
  amount: number;
  expense_date: string;
  description: string | null;
  notes: string | null;
  receipt_file_path: string | null;
  category_id: string;
  category?: ExpenseCategory;
  recurring_type: string; // Database returns string, we'll handle the typing
}

interface ExpenseBudget {
  id: string;
  year: number;
  month: number;
  budget_amount: number;
}

export const ExpenseManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isSettingBudget, setIsSettingBudget] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  const [newExpense, setNewExpense] = useState({
    amount: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    notes: "",
    category_id: "",
    receipt_file: null as File | null,
    recurring_type: "none"
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    color: "#3b82f6"
  });

  const [budgetAmount, setBudgetAmount] = useState("");

  useEffect(() => {
    if (user) {
      loadCategories();
      loadExpenses();
      loadBudgets();
    }
  }, [user, selectedMonth, selectedYear]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("is_active", true)
      .order("order_index");
    
    if (error) {
      toast({ title: "Fehler", description: "Kategorien konnten nicht geladen werden", variant: "destructive" });
    } else {
      setCategories(data || []);
    }
  };

  const loadExpenses = async () => {
    // Fix date range calculation - ensure we get the actual last day of the month
    const year = selectedYear;
    const month = selectedMonth;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate(); // Get actual last day of month
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    console.log('Loading expenses for date range:', startDate, 'to', endDate);
    
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        *,
        category:expense_categories(*)
      `)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });
    
    if (error) {
      console.error('Error loading expenses:', error);
      toast({ title: "Fehler", description: "Ausgaben konnten nicht geladen werden", variant: "destructive" });
    } else {
      console.log('Loaded expenses:', data?.length || 0);
      setExpenses((data as Expense[]) || []);
    }
  };

  const loadBudgets = async () => {
    const { data, error } = await supabase
      .from("expense_budgets")
      .select("*")
      .eq("user_id", user?.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    
    if (error) {
      toast({ title: "Fehler", description: "Budgets konnten nicht geladen werden", variant: "destructive" });
    } else {
      setBudgets(data || []);
    }
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    console.log('Starting receipt upload for file:', file.name, 'Size:', file.size);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    // Korrigiere den Pfad: user_id/receipts/filename statt receipts/user_id-filename
    const filePath = `${user?.id}/receipts/${fileName}`;

    console.log('Uploading to path:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast({ title: "Fehler", description: `Beleg konnte nicht hochgeladen werden: ${uploadError.message}`, variant: "destructive" });
      return null;
    }

    console.log('Upload successful, file path:', filePath);
    return filePath;
  };

  const addExpense = async () => {
    console.log('Adding expense with data:', newExpense);
    
    if (!newExpense.amount || !newExpense.category_id) {
      toast({ title: "Fehler", description: "Betrag und Kategorie sind erforderlich", variant: "destructive" });
      return;
    }

    let receiptPath = null;
    if (newExpense.receipt_file) {
      console.log('Receipt file selected, starting upload...');
      receiptPath = await uploadReceipt(newExpense.receipt_file);
      if (!receiptPath) {
        console.error('Receipt upload failed, aborting expense creation');
        return;
      }
      console.log('Receipt uploaded successfully to:', receiptPath);
    }

    const { error } = await supabase
      .from("expenses")
      .insert({
        user_id: user?.id,
        amount: parseFloat(newExpense.amount),
        expense_date: newExpense.expense_date,
        description: newExpense.description || null,
        notes: newExpense.notes || null,
        receipt_file_path: receiptPath,
        category_id: newExpense.category_id,
        recurring_type: newExpense.recurring_type
      });

    if (error) {
      toast({ title: "Fehler", description: "Ausgabe konnte nicht hinzugefügt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Ausgabe wurde hinzugefügt" });
      setNewExpense({
        amount: "",
        expense_date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        notes: "",
        category_id: "",
        receipt_file: null,
        recurring_type: "none"
      });
      setIsAddingExpense(false);
      loadExpenses();
    }
  };

  const addCategory = async () => {
    if (!newCategory.name) {
      toast({ title: "Fehler", description: "Name ist erforderlich", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("expense_categories")
      .insert({
        name: newCategory.name,
        description: newCategory.description || null,
        color: newCategory.color,
        order_index: categories.length
      });

    if (error) {
      toast({ title: "Fehler", description: "Kategorie konnte nicht hinzugefügt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Kategorie wurde hinzugefügt" });
      setNewCategory({ name: "", description: "", color: "#3b82f6" });
      setIsAddingCategory(false);
      loadCategories();
    }
  };

  const setBudget = async () => {
    if (!budgetAmount) {
      toast({ title: "Fehler", description: "Budget-Betrag ist erforderlich", variant: "destructive" });
      return;
    }

    const amount = parseFloat(budgetAmount);

    // Set budget for current month
    const { error } = await supabase
      .from("expense_budgets")
      .upsert({
        user_id: user?.id,
        year: selectedYear,
        month: selectedMonth,
        budget_amount: amount
      });

    if (error) {
      toast({ title: "Fehler", description: "Budget konnte nicht gesetzt werden", variant: "destructive" });
      return;
    }

    // Apply budget to future months that don't have a budget yet
    const currentDate = new Date(selectedYear, selectedMonth - 1);
    const futureMonths = [];
    
    for (let i = 1; i <= 12; i++) {
      const futureDate = new Date(currentDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      
      const year = futureDate.getFullYear();
      const month = futureDate.getMonth() + 1;
      
      // Check if budget already exists for this month
      const existingBudget = budgets.find(b => b.year === year && b.month === month);
      if (!existingBudget) {
        futureMonths.push({ user_id: user?.id, year, month, budget_amount: amount });
      }
    }

    if (futureMonths.length > 0) {
      await supabase.from("expense_budgets").insert(futureMonths);
    }

    toast({ title: "Erfolg", description: `Budget wurde gesetzt und auf ${futureMonths.length} weitere Monate angewendet` });
    setBudgetAmount("");
    setIsSettingBudget(false);
    loadBudgets();
  };

  const getCurrentBudget = () => {
    return budgets.find(b => b.year === selectedYear && b.month === selectedMonth);
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const getBalance = () => {
    const budget = getCurrentBudget();
    return (budget?.budget_amount || 0) - getTotalExpenses();
  };

  const getCategoryExpenses = () => {
    const categoryTotals = new Map();
    expenses.forEach(expense => {
      const categoryName = expense.category?.name || "Unbekannt";
      const categoryColor = expense.category?.color || "#6b7280";
      const currentTotal = categoryTotals.get(categoryName) || { total: 0, color: categoryColor };
      categoryTotals.set(categoryName, { 
        total: currentTotal.total + expense.amount, 
        color: categoryColor 
      });
    });
    return Array.from(categoryTotals.entries()).map(([name, data]) => ({ 
      name, 
      total: data.total, 
      color: data.color 
    }));
  };

  const getRecurringIcon = (recurringType: string) => {
    if (recurringType === 'none') return null;
    
    const getRecurringText = (type: string) => {
      switch (type) {
        case 'monthly': return 'Monatlich';
        case 'quarterly': return 'Vierteljährlich';
        case 'semi-annually': return 'Halbjährlich';  
        case 'yearly': return 'Jährlich';
        default: return '';
      }
    };

    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Repeat className="h-3 w-3" />
        <span>{getRecurringText(recurringType)}</span>
      </div>
    );
  };

  const exportToCSV = () => {
    const headers = ['Datum', 'Beschreibung', 'Kategorie', 'Betrag', 'Hinweise'];
    const csvData = expenses.map(expense => [
      format(new Date(expense.expense_date), "dd.MM.yyyy"),
      expense.description || '',
      expense.category?.name || 'Unbekannt',
      expense.amount.toFixed(2),
      expense.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ausgaben-${format(new Date(selectedYear, selectedMonth - 1), "yyyy-MM", { locale: de })}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kostenmanagement</h2>
          <p className="text-muted-foreground">Verwaltung von Ausgaben und Kostenpauschalen</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {format(new Date(2024, i), "MMMM", { locale: de })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (
                <SelectItem key={2024 + i} value={(2024 + i).toString()}>
                  {2024 + i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getCurrentBudget()?.budget_amount?.toFixed(2) || "0.00"} €
            </div>
            <p className="text-xs text-muted-foreground">
              Monatliche Kostenpauschale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausgaben</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalExpenses().toFixed(2)} €</div>
            <p className="text-xs text-muted-foreground">
              Summe dieses Monats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {getBalance().toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground">
              Verbleibendes Budget
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses">Ausgaben</TabsTrigger>
          <TabsTrigger value="categories">Kategorien</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Ausgaben</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Ausgabe hinzufügen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Neue Ausgabe</DialogTitle>
                    <DialogDescription>
                      Fügen Sie eine neue Ausgabe hinzu
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Betrag (€)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Datum</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newExpense.expense_date}
                        onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Kategorie</Label>
                      <Select value={newExpense.category_id} onValueChange={(value) => setNewExpense({...newExpense, category_id: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Kategorie wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">Beschreibung</Label>
                      <Input
                        id="description"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Hinweise</Label>
                      <Textarea
                        id="notes"
                        value={newExpense.notes}
                        onChange={(e) => setNewExpense({...newExpense, notes: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recurring">Wiederholung</Label>
                      <Select value={newExpense.recurring_type} onValueChange={(value) => setNewExpense({...newExpense, recurring_type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Wiederholung wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keine Wiederholung</SelectItem>
                          <SelectItem value="monthly">Monatlich</SelectItem>
                          <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                          <SelectItem value="semi-annually">Halbjährlich</SelectItem>
                          <SelectItem value="yearly">Jährlich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="receipt">Beleg hochladen</Label>
                      <Input
                        id="receipt"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setNewExpense({...newExpense, receipt_file: e.target.files?.[0] || null})}
                      />
                    </div>
                    <Button onClick={addExpense} className="w-full">
                      Ausgabe hinzufügen
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Wiederholung</TableHead>
                    <TableHead>Beleg</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.expense_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{expense.description || "Keine Beschreibung"}</div>
                          {expense.notes && (
                            <div className="text-sm text-muted-foreground">{expense.notes}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-sm border" 
                            style={{ backgroundColor: expense.category?.color || "#6b7280" }}
                          />
                          <Badge variant="outline">
                            {expense.category?.name || "Unbekannt"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRecurringIcon(expense.recurring_type)}
                      </TableCell>
                      <TableCell>
                        {expense.receipt_file_path ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const { data } = supabase.storage.from('documents').getPublicUrl(expense.receipt_file_path!);
                              window.open(data.publicUrl, '_blank');
                            }}
                          >
                            <FileImage className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">Kein Beleg</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {expense.amount.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Keine Ausgaben für diesen Monat
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kategorien</h3>
            <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Kategorie hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Kategorie</DialogTitle>
                  <DialogDescription>
                    Fügen Sie eine neue Ausgabenkategorie hinzu
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cat-name">Name</Label>
                    <Input
                      id="cat-name"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cat-description">Beschreibung</Label>
                    <Textarea
                      id="cat-description"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cat-color">Farbe</Label>
                    <Input
                      id="cat-color"
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                    />
                  </div>
                  <Button onClick={addCategory} className="w-full">
                    Kategorie hinzufügen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Badge style={{ backgroundColor: category.color }}>
                      {category.name}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {category.description || "Keine Beschreibung"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Budget verwalten</h3>
            <Dialog open={isSettingBudget} onOpenChange={setIsSettingBudget}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Budget setzen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Budget für {format(new Date(selectedYear, selectedMonth - 1), "MMMM yyyy", { locale: de })}</DialogTitle>
                  <DialogDescription>
                    Setzen Sie die monatliche Kostenpauschale
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="budget">Budget (€)</Label>
                    <Input
                      id="budget"
                      type="number"
                      step="0.01"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      placeholder={getCurrentBudget()?.budget_amount?.toString() || "0.00"}
                    />
                  </div>
                  <Button onClick={setBudget} className="w-full">
                    Budget setzen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Budgets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monat</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.slice(0, 12).map((budget) => (
                    <TableRow key={`${budget.year}-${budget.month}`}>
                      <TableCell>
                        {format(new Date(budget.year, budget.month - 1), "MMMM yyyy", { locale: de })}
                      </TableCell>
                      <TableCell className="text-right">
                        {budget.budget_amount.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                  {budgets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Keine Budgets definiert
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Ausgaben nach Kategorien</h3>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                Liste
              </Button>
              <Button
                variant={viewMode === 'chart' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('chart')}
              >
                <PieChart className="h-4 w-4 mr-2" />
                Diagramm
              </Button>
            </div>
          </div>
          
          {viewMode === 'list' ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kategorie</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead className="text-right">Anteil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCategoryExpenses().map(({ name, total, color }) => (
                      <TableRow key={name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-sm border" 
                              style={{ backgroundColor: color }}
                            />
                            {name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{total.toFixed(2)} €</TableCell>
                        <TableCell className="text-right">
                          {getTotalExpenses() > 0 ? ((total / getTotalExpenses()) * 100).toFixed(1) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {getCategoryExpenses().length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Keine Ausgaben für diesen Monat
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                {getCategoryExpenses().length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <defs>
                          {getCategoryExpenses().map(({ name, color }, index) => (
                            <pattern key={name} id={`pattern-${index}`} patternUnits="userSpaceOnUse" width="4" height="4">
                              <rect width="4" height="4" fill={color} />
                            </pattern>
                          ))}
                        </defs>
                        <Pie
                          data={getCategoryExpenses().map(({ name, total, color }) => ({
                            name,
                            value: total,
                            fill: color
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getCategoryExpenses().map(({ color }, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value.toFixed(2)} €`, 'Betrag']} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    Keine Ausgaben für diesen Monat
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};