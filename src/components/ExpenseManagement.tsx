import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Euro, TrendingUp, Calendar, Download, FileImage, Repeat, List, PieChart } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip, Legend, Pie } from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { useExpenseData } from "./expenses/hooks/useExpenseData";

interface PieLabelProps {
  name?: string;
  percent?: number;
}

const renderCategoryPieLabel = (input: unknown): string => {
  if (!input || typeof input !== 'object') return '';
  const candidate = input as PieLabelProps;
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const percent = typeof candidate.percent === 'number' ? candidate.percent : undefined;
  return name && typeof percent === 'number' ? `${name} ${(percent * 100).toFixed(0)}%` : name;
};

const getRecurringIcon = (recurringType: string) => {
  if (recurringType === 'none') return null;
  const labels: Record<string, string> = { monthly: 'Monatlich', quarterly: 'Vierteljährlich', 'semi-annually': 'Halbjährlich', yearly: 'Jährlich' };
  return <div className="flex items-center gap-1 text-xs text-muted-foreground"><Repeat className="h-3 w-3" /><span>{labels[recurringType] || ''}</span></div>;
};

export const ExpenseManagement = () => {
  const data = useExpenseData();
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isSettingBudget, setIsSettingBudget] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const [newExpense, setNewExpense] = useState({ amount: "", expense_date: format(new Date(), "yyyy-MM-dd"), description: "", notes: "", category_id: "", receipt_file: null as File | null, recurring_type: "none" });
  const [newCategory, setNewCategory] = useState({ name: "", description: "", color: "#3b82f6" });
  const [budgetAmount, setBudgetAmount] = useState("");

  const handleAddExpense = async () => {
    const success = await data.addExpense(newExpense);
    if (success) { setNewExpense({ amount: "", expense_date: format(new Date(), "yyyy-MM-dd"), description: "", notes: "", category_id: "", receipt_file: null, recurring_type: "none" }); setIsAddingExpense(false); }
  };

  const handleAddCategory = async () => {
    const success = await data.addCategory(newCategory);
    if (success) { setNewCategory({ name: "", description: "", color: "#3b82f6" }); setIsAddingCategory(false); }
  };

  const handleSetBudget = async () => {
    const success = await data.setBudgetAmount(budgetAmount);
    if (success) { setBudgetAmount(""); setIsSettingBudget(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Kostenmanagement</h2><p className="text-muted-foreground">Verwaltung von Ausgaben und Kostenpauschalen</p></div>
        <div className="flex items-center gap-4">
          <Select value={data.selectedMonth.toString()} onValueChange={(v) => data.setSelectedMonth(parseInt(v))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{format(new Date(2024, i), "MMMM", { locale: de })}</SelectItem>)}</SelectContent></Select>
          <Select value={data.selectedYear.toString()} onValueChange={(v) => data.setSelectedYear(parseInt(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 5 }, (_, i) => <SelectItem key={2024 + i} value={(2024 + i).toString()}>{2024 + i}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Budget</CardTitle><Euro className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{data.getCurrentBudget()?.budget_amount?.toFixed(2) || "0.00"} €</div><p className="text-xs text-muted-foreground">Monatliche Kostenpauschale</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ausgaben</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{data.getTotalExpenses().toFixed(2)} €</div><p className="text-xs text-muted-foreground">Summe dieses Monats</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Saldo</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${data.getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>{data.getBalance().toFixed(2)} €</div><p className="text-xs text-muted-foreground">Verbleibendes Budget</p></CardContent></Card>
      </div>

      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList><TabsTrigger value="expenses">Ausgaben</TabsTrigger><TabsTrigger value="categories">Kategorien</TabsTrigger><TabsTrigger value="budget">Budget</TabsTrigger><TabsTrigger value="overview">Übersicht</TabsTrigger></TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Ausgaben</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={data.exportToCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
              <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Ausgabe hinzufügen</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Neue Ausgabe</DialogTitle><DialogDescription>Fügen Sie eine neue Ausgabe hinzu</DialogDescription></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Betrag (€)</Label><Input type="number" step="0.01" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} /></div>
                    <div><Label>Datum</Label><Input type="date" value={newExpense.expense_date} onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})} /></div>
                    <div><Label>Kategorie</Label><Select value={newExpense.category_id} onValueChange={(v) => setNewExpense({...newExpense, category_id: v})}><SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger><SelectContent>{data.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Beschreibung</Label><Input value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})} /></div>
                    <div><Label>Hinweise</Label><Textarea value={newExpense.notes} onChange={(e) => setNewExpense({...newExpense, notes: e.target.value})} /></div>
                    <div><Label>Wiederholung</Label><Select value={newExpense.recurring_type} onValueChange={(v) => setNewExpense({...newExpense, recurring_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem><SelectItem value="monthly">Monatlich</SelectItem><SelectItem value="quarterly">Vierteljährlich</SelectItem><SelectItem value="semi-annually">Halbjährlich</SelectItem><SelectItem value="yearly">Jährlich</SelectItem></SelectContent></Select></div>
                    <div><Label>Beleg</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setNewExpense({...newExpense, receipt_file: e.target.files?.[0] || null})} /></div>
                    <Button onClick={handleAddExpense} className="w-full">Ausgabe hinzufügen</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Beschreibung</TableHead><TableHead>Kategorie</TableHead><TableHead>Wiederholung</TableHead><TableHead>Beleg</TableHead><TableHead className="text-right">Betrag</TableHead></TableRow></TableHeader><TableBody>
            {data.expenses.map(expense => (
              <TableRow key={expense.id}>
                <TableCell>{format(new Date(expense.expense_date), "dd.MM.yyyy")}</TableCell>
                <TableCell><div><div className="font-medium">{expense.description || "Keine Beschreibung"}</div>{expense.notes && <div className="text-sm text-muted-foreground">{expense.notes}</div>}</div></TableCell>
                <TableCell><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: expense.category?.color || "#6b7280" }} /><Badge variant="outline">{expense.category?.name || "Unbekannt"}</Badge></div></TableCell>
                <TableCell>{getRecurringIcon(expense.recurring_type)}</TableCell>
                <TableCell>{expense.receipt_file_path ? <Button variant="ghost" size="sm" onClick={() => { const { data: d } = supabase.storage.from('documents').getPublicUrl(expense.receipt_file_path!); window.open(d.publicUrl, '_blank'); }}><FileImage className="h-4 w-4" /></Button> : <span className="text-muted-foreground text-sm">Kein Beleg</span>}</TableCell>
                <TableCell className="text-right font-medium">{expense.amount.toFixed(2)} €</TableCell>
              </TableRow>
            ))}
            {data.expenses.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Ausgaben für diesen Monat</TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kategorien</h3>
            <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Kategorie hinzufügen</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Neue Kategorie</DialogTitle><DialogDescription>Fügen Sie eine neue Ausgabenkategorie hinzu</DialogDescription></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name</Label><Input value={newCategory.name} onChange={(e) => setNewCategory({...newCategory, name: e.target.value})} /></div>
                  <div><Label>Beschreibung</Label><Textarea value={newCategory.description} onChange={(e) => setNewCategory({...newCategory, description: e.target.value})} /></div>
                  <div><Label>Farbe</Label><Input type="color" value={newCategory.color} onChange={(e) => setNewCategory({...newCategory, color: e.target.value})} /></div>
                  <Button onClick={handleAddCategory} className="w-full">Kategorie hinzufügen</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.categories.map(cat => <Card key={cat.id}><CardHeader><CardTitle className="flex items-center justify-between"><Badge style={{ backgroundColor: cat.color || undefined }}>{cat.name}</Badge></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{cat.description || "Keine Beschreibung"}</p></CardContent></Card>)}
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Budget verwalten</h3>
            <Dialog open={isSettingBudget} onOpenChange={setIsSettingBudget}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Budget setzen</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Budget für {format(new Date(data.selectedYear, data.selectedMonth - 1), "MMMM yyyy", { locale: de })}</DialogTitle><DialogDescription>Setzen Sie die monatliche Kostenpauschale</DialogDescription></DialogHeader>
                <div className="space-y-4"><div><Label>Budget (€)</Label><Input type="number" step="0.01" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder={data.getCurrentBudget()?.budget_amount?.toString() || "0.00"} /></div><Button onClick={handleSetBudget} className="w-full">Budget setzen</Button></div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardHeader><CardTitle>Aktuelle Budgets</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Monat</TableHead><TableHead className="text-right">Budget</TableHead></TableRow></TableHeader><TableBody>
            {data.budgets.slice(0, 12).map(b => <TableRow key={`${b.year}-${b.month}`}><TableCell>{format(new Date(b.year, b.month - 1), "MMMM yyyy", { locale: de })}</TableCell><TableCell className="text-right">{b.budget_amount.toFixed(2)} €</TableCell></TableRow>)}
            {data.budgets.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Keine Budgets definiert</TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Ausgaben nach Kategorien</h3>
            <div className="flex gap-2">
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}><List className="h-4 w-4 mr-2" />Liste</Button>
              <Button variant={viewMode === 'chart' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('chart')}><PieChart className="h-4 w-4 mr-2" />Diagramm</Button>
            </div>
          </div>
          {viewMode === 'list' ? (
            <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Kategorie</TableHead><TableHead className="text-right">Betrag</TableHead><TableHead className="text-right">Anteil</TableHead></TableRow></TableHeader><TableBody>
              {data.getCategoryExpenses().map(({ name, total, color }) => <TableRow key={name}><TableCell><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: color }} />{name}</div></TableCell><TableCell className="text-right">{total.toFixed(2)} €</TableCell><TableCell className="text-right">{data.getTotalExpenses() > 0 ? ((total / data.getTotalExpenses()) * 100).toFixed(1) : 0}%</TableCell></TableRow>)}
              {data.getCategoryExpenses().length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Keine Ausgaben für diesen Monat</TableCell></TableRow>}
            </TableBody></Table></CardContent></Card>
          ) : (
            <Card><CardContent className="p-6">
              {data.getCategoryExpenses().length > 0 ? (
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart>
                  <Pie data={data.getCategoryExpenses().map(({ name, total, color }) => ({ name, value: total, fill: color }))} cx="50%" cy="50%" labelLine={false} label={renderCategoryPieLabel} outerRadius={80} fill="#8884d8" dataKey="value">
                    {data.getCategoryExpenses().map(({ color }, i) => <Cell key={`cell-${i}`} fill={color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value.toFixed(2)} €`, 'Betrag']} /><Legend />
                </RechartsPieChart></ResponsiveContainer></div>
              ) : <div className="text-center text-muted-foreground py-12">Keine Ausgaben für diesen Monat</div>}
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
