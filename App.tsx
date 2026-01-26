import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, MonthData, ViewState, Expense, ExpenseType, User } from './types';
import { v4 as uuidv4 } from 'uuid';
import { generateMonthId, getMonthLabel, calculateTotals, formatCurrency, calculateAccumulatedSavings, FinanceAPI } from './services/financeService';
import { supabaseAuthService } from './services/supabaseAuthService';
import { supabase } from './services/supabaseClient';
import { CATEGORIES, MONTH_NAMES } from './constants';
import {
    Button, Card, Input, Select, StatCard, FeedbackMessage, EmptyState, OnboardingBanner,
    PlusIcon, TrashIcon, EditIcon,
    PigIcon, CalendarIcon, WalletIcon, MoneyIcon, ShoppingBagIcon, PieChartIcon,
    ArrowRightIcon, ArrowLeftIcon, MenuIcon, CrownIcon
} from './components/UIComponents';
import { AuthScreen } from './components/Auth';


// TODO: Replace with your actual Stripe Price ID (e.g., price_1Mc...)


// Debounce helper function
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Initial State Helper
const getInitialMonth = (date = new Date()): MonthData => ({
    id: generateMonthId(date),
    label: getMonthLabel(date),
    salary1: 0,
    salary2: 0,
    expenses: [],
    closed: false,
});

const App: React.FC = () => {
    // --- Auth State ---
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // --- App State ---
    const [months, setMonths] = useState<MonthData[]>([]);
    const [dataLoading, setDataLoading] = useState(false); // New loading state for data
    const [currentMonthId, setCurrentMonthId] = useState<string>('');
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.MONTH_SELECTION);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Month Creation Form State
    const [newMonthIndex, setNewMonthIndex] = useState(new Date().getMonth());
    const [newYear, setNewYear] = useState(new Date().getFullYear());

    // Expense Form State
    const [expenseForm, setExpenseForm] = useState<{ name: string; value: string; category: string; date: string }>({
        name: '', value: '', category: 'Outros', date: new Date().toISOString().split('T')[0]
    });

    // Salary Form State & UI
    const [salaryForm, setSalaryForm] = useState({ salary1: '', salary2: '' });

    // Global Feedback State
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

    // Save Status State
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Password Modal State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

    // Helper to show feedback
    const showFeedback = (message: string, type: 'success' | 'danger' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

    // --- Auth Effects ---
    useEffect(() => {
        // Initial Session Check
        supabaseAuthService.getSession().then(session => {
            setUser(session ? { id: session.user.id, email: session.user.email!, name: session.user.user_metadata.name } : null);
            setAuthLoading(false);
        });

        // Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session ? { id: session.user.id, email: session.user.email!, name: session.user.user_metadata.name } : null);
            setAuthLoading(false);
            if (!session) {
                setMonths([]); // Clear data on logout
                setCurrentMonthId('');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // --- Onboarding State ---
    const [onboardingStep, setOnboardingStep] = useState(0);

    useEffect(() => {
        const hasSeen = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeen && user) {
            setOnboardingStep(1);
        }
    }, [user]);

    const handleNextOnboarding = () => {
        if (onboardingStep === 1) {
            setCurrentView(ViewState.SALARIES);
            setOnboardingStep(2);
        } else if (onboardingStep === 2) {
            setCurrentView(ViewState.EXPENSES_FIXED); // Or variable, or standard view
            setOnboardingStep(3);
        } else if (onboardingStep === 3) {
            setCurrentView(ViewState.DASHBOARD);
            setOnboardingStep(0);
            localStorage.setItem('hasSeenOnboarding', 'true');
            showFeedback("Tudo pronto! Seu sistema está configurado.");
        }
    };

    const handleSkipOnboarding = () => {
        setOnboardingStep(0);
        localStorage.setItem('hasSeenOnboarding', 'true');
    };

    const handleRestartOnboarding = () => {
        setOnboardingStep(1);
        setCurrentView(ViewState.SALARIES);
        localStorage.removeItem('hasSeenOnboarding');
    };

    const handleLogout = async () => {
        await supabaseAuthService.signOut();
        // State update handled by onAuthStateChange
    };

    // --- Data Loading Effect (Simulating Backend Fetch) ---
    useEffect(() => {
        if (!user) return; // Wait for login

        const loadData = async () => {
            setDataLoading(true);
            try {
                const fetchedMonths = await FinanceAPI.getMonths(user.id);

                if (fetchedMonths.length > 0) {
                    setMonths(fetchedMonths);
                    // Smart selection of current month
                    const actualCurrentId = generateMonthId(new Date());
                    const exists = fetchedMonths.find((m: MonthData) => m.id === actualCurrentId);

                    if (exists) {
                        setCurrentMonthId(actualCurrentId);
                    } else {
                        const sorted = [...fetchedMonths].sort((a, b) => a.id.localeCompare(b.id));
                        setCurrentMonthId(sorted[sorted.length - 1].id);
                    }
                    setCurrentView(ViewState.MONTH_SELECTION);
                } else {
                    const initial = getInitialMonth();
                    setMonths([initial]);
                    setCurrentMonthId(initial.id);
                    setCurrentView(ViewState.MONTH_SELECTION);
                    // Auto-save the initial state
                    await FinanceAPI.saveMonths(user.id, [initial]);
                }
            } catch (error) {
                console.error("Failed to load data", error);
                alert("Erro ao carregar dados. Verifique sua conexão.");
            } finally {
                setDataLoading(false);
            }
        };

        loadData();
    }, [user]);

    // --- Optimized Data Saving with Debounce ---
    // Debounced save function that saves only the current month
    const debouncedSave = useCallback(
        debounce(async (userId: string, monthData: MonthData) => {
            setSaveStatus('saving');
            try {
                await FinanceAPI.saveMonth(userId, monthData);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                setSaveStatus('error');
                console.error('Save failed:', error);
                setTimeout(() => setSaveStatus('idle'), 5000);
            }
        }, 2000),
        []
    );

    // --- Computeds ---
    const currentMonthData = useMemo(() =>
        months.find(m => m.id === currentMonthId) || getInitialMonth(),
        [months, currentMonthId]);

    // Trigger save only when current month changes
    useEffect(() => {
        if (user && currentMonthData && currentMonthData.id && months.length > 0) {
            debouncedSave(user.id, currentMonthData);
        }
    }, [currentMonthData, user, debouncedSave, months.length]);

    // Sync Salary Form when Data Changes
    useEffect(() => {
        if (currentMonthId) {
            const m = months.find(m => m.id === currentMonthId);
            if (m) {
                setSalaryForm({
                    salary1: m.salary1 > 0 ? m.salary1.toString() : '',
                    salary2: m.salary2 > 0 ? m.salary2.toString() : ''
                });
            }
        }
    }, [currentMonthId, months]);

    // Reset UI state on navigation
    useEffect(() => {
        setFeedback(null);
    }, [currentMonthId, currentView]);

    // --- Computeds (continued) ---

    const totals = useMemo(() => calculateTotals(currentMonthData), [currentMonthData]);

    const totalSavings = useMemo(() => calculateAccumulatedSavings(months), [months]);

    // --- Handlers ---

    const handleCreateSpecificMonth = () => {
        const date = new Date(newYear, newMonthIndex, 1);
        const newId = generateMonthId(date);
        const label = getMonthLabel(date);

        // Check if exists
        const existing = months.find(m => m.id === newId);
        if (existing) {
            setCurrentMonthId(newId);
            setCurrentView(ViewState.DASHBOARD);
            return;
        }

        // Check for previous month data to import
        // Find the latest month before this new one
        const sortedMonths = [...months].sort((a, b) => a.id.localeCompare(b.id));
        const previousMonth = sortedMonths.reverse().find(m => m.id < newId);

        let importedExpenses: Expense[] = [];
        if (previousMonth) {
            if (window.confirm(`Deseja importar as despesas fixas de ${previousMonth.label}?`)) {
                const currentYear = date.getFullYear();
                const currentMonth = date.getMonth() + 1;

                importedExpenses = previousMonth.expenses
                    .filter(e => e.type === 'fixed')
                    .map(e => {
                        const day = e.date.split('-')[2] || '01';
                        return {
                            ...e,
                            id: uuidv4(),
                            date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${day}`
                        };
                    });
            }
        }

        const newMonthData: MonthData = {
            id: newId,
            label: label,
            salary1: previousMonth ? previousMonth.salary1 : 0,
            salary2: previousMonth ? previousMonth.salary2 : 0,
            expenses: importedExpenses,
            closed: false
        };

        setMonths(prev => [...prev, newMonthData]);
        setCurrentMonthId(newId);
        setCurrentView(ViewState.DASHBOARD);
    };

    const handleSelectMonth = (id: string) => {
        setCurrentMonthId(id);
        setCurrentView(ViewState.DASHBOARD);
    }

    const handleDeleteMonth = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Tem certeza que deseja excluir este mês e todos os seus dados permanentemente?")) {
            setMonths(prev => {
                const updated = prev.filter(m => m.id !== id);
                return updated;
            });

            if (currentMonthId === id) {
                setCurrentMonthId('');
                setCurrentView(ViewState.MONTH_SELECTION);
            }
        }
    };

    const handleResetMonth = () => {
        if (window.confirm("ATENÇÃO: Isso apagará todos os salários e despesas deste mês. Deseja continuar?")) {
            updateCurrentMonth(m => ({
                ...m,
                salary1: 0,
                salary2: 0,
                expenses: [],
                closed: false
            }));
        }
    };

    const updateCurrentMonth = (updater: (m: MonthData) => MonthData) => {
        setMonths(prev => prev.map(m => m.id === currentMonthId ? updater(m) : m));
    };

    const handleSalaryChange = (field: 'salary1' | 'salary2', value: string) => {
        setSalaryForm(prev => ({ ...prev, [field]: value }));
        setFeedback(null);
    };

    const handleSaveSalaries = () => {
        updateCurrentMonth(m => ({
            ...m,
            salary1: Number(salaryForm.salary1) || 0,
            salary2: Number(salaryForm.salary2) || 0
        }));
        showFeedback("Salários salvos com sucesso!");
    };

    const handleAddExpense = (type: ExpenseType) => {
        if (!expenseForm.name || !expenseForm.value) return;

        const newExpense: Expense = {
            id: uuidv4(),
            name: expenseForm.name,
            value: Number(expenseForm.value),
            category: expenseForm.category,
            date: expenseForm.date,
            type
        };

        updateCurrentMonth(m => ({
            ...m,
            expenses: [...m.expenses, newExpense]
        }));

        setExpenseForm({ name: '', value: '', category: 'Outros', date: new Date().toISOString().split('T')[0] });
        setEditingExpense(null);
        showFeedback("Despesa adicionada com sucesso!");
    };

    const handleUpdateExpense = () => {
        if (!editingExpense || !expenseForm.name || !expenseForm.value) return;

        updateCurrentMonth(m => ({
            ...m,
            expenses: m.expenses.map(e => e.id === editingExpense.id ? {
                ...e,
                name: expenseForm.name,
                value: Number(expenseForm.value),
                category: expenseForm.category,
                date: expenseForm.date
            } : e)
        }));

        setEditingExpense(null);
        setExpenseForm({ name: '', value: '', category: 'Outros', date: new Date().toISOString().split('T')[0] });
        showFeedback("Despesa atualizada com sucesso!");
    };

    const handleDeleteExpense = (id: string) => {
        if (window.confirm('Tem certeza?')) {
            updateCurrentMonth(m => ({
                ...m,
                expenses: m.expenses.filter(e => e.id !== id)
            }));
            showFeedback("Despesa removida.", "danger");
        }
    };

    const handleEditClick = (expense: Expense) => {
        setEditingExpense(expense);
        setExpenseForm({
            name: expense.name,
            value: expense.value.toString(),
            category: expense.category || 'Outros',
            date: expense.date || new Date().toISOString().split('T')[0]
        });
        // Scroll to top of form area
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleImportFixedExpenses = () => {
        // Logic to find previous month relative to current
        const sortedMonths = [...months].sort((a, b) => a.id.localeCompare(b.id));
        const currentIndex = sortedMonths.findIndex(m => m.id === currentMonthId);

        if (currentIndex <= 0) {
            alert("Não há mês anterior registrado para importar.");
            return;
        }

        const prevMonth = sortedMonths[currentIndex - 1];
        const fixedExpensesToImport = prevMonth.expenses.filter(e => e.type === 'fixed');

        if (fixedExpensesToImport.length === 0) {
            alert(`O mês de ${prevMonth.label} não possui despesas fixas.`);
            return;
        }

        if (window.confirm(`Deseja importar ${fixedExpensesToImport.length} despesas fixas de ${prevMonth.label}?`)) {
            const currentYear = parseInt(currentMonthData.id.split('-')[0]);
            const currentMonth = parseInt(currentMonthData.id.split('-')[1]);

            const newExpenses = fixedExpensesToImport.map(e => {
                const day = e.date.split('-')[2] || '01';
                return {
                    ...e,
                    id: uuidv4(),
                    date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${day}`
                };
            });

            updateCurrentMonth(m => ({
                ...m,
                expenses: [...m.expenses, ...newExpenses]
            }));
            showFeedback(`${newExpenses.length} despesas importadas com sucesso!`);
        }
    };

    const handleCloseMonth = () => {
        if (totals.balance <= 0) {
            alert("Apenas saldos positivos podem ser enviados para a caixinha.");
            return;
        }
        updateCurrentMonth(m => ({ ...m, closed: true }));
        showFeedback("Sucesso! O saldo foi registrado na sua caixinha.");
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            setPasswordFeedback({ message: "A senha deve ter pelo menos 6 caracteres", type: 'danger' });
            return;
        }
        setPasswordLoading(true);
        setPasswordFeedback(null);
        try {
            await supabaseAuthService.updatePassword(newPassword);
            setPasswordFeedback({ message: "Senha alterada com sucesso!", type: 'success' });
            setTimeout(() => {
                setIsPasswordModalOpen(false);
                setNewPassword('');
                setPasswordFeedback(null);
            }, 2000);
        } catch (e: any) {
            setPasswordFeedback({ message: "Erro ao alterar senha: " + e.message, type: 'danger' });
        } finally {
            setPasswordLoading(false);
        }
    };



    // --- Views Renders ---

    const renderMonthSelection = () => (
        <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
            <Card className="border-none shadow-md">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                        <CalendarIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Planejar novo mês</h2>
                        <p className="text-slate-500">Comece a organizar as contas de um novo período</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Mês</label>
                        <Select value={newMonthIndex} onChange={e => setNewMonthIndex(Number(e.target.value))}>
                            {MONTH_NAMES.map((name, index) => (
                                <option key={index} value={index}>{name}</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Ano</label>
                        <Select value={newYear} onChange={e => setNewYear(Number(e.target.value))}>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </Select>
                    </div>
                </div>

                <Button className="w-full h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all transform hover:scale-[1.01]" onClick={handleCreateSpecificMonth}>
                    Criar Mês
                </Button>
            </Card>

            <Card className="border-none shadow-md">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-slate-100 text-slate-500 rounded-full">
                        <CalendarIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Histórico</h2>
                        <p className="text-slate-500">Veja como foram os meses anteriores</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {[...months].sort((a, b) => b.id.localeCompare(a.id)).map(month => (
                        <div
                            key={month.id}
                            onClick={() => handleSelectMonth(month.id)}
                            className={`group relative flex items-center p-4 rounded-xl border border-slate-100 cursor-pointer transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-sm ${currentMonthId === month.id ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200' : 'bg-slate-50'}`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm mr-4 ${currentMonthId === month.id ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 shadow-sm'}`}>
                                {month.id.split('-')[1]}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-slate-800">{month.label}</h4>
                                <p className="text-sm text-slate-500">{month.expenses.length} despesas</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    onClick={(e) => e.stopPropagation()} /* Ensure click on delete container doesn't select month */
                                >
                                    <Button variant="danger" className="p-2 h-auto" onClick={(e) => handleDeleteMonth(month.id, e)}>
                                        <TrashIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="text-slate-400">
                                    <ArrowRightIcon />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );

    const renderDashboard = () => (
        <div className="space-y-8 animate-fade-in">
            {/* Emotional Positioning Block */}
            <div className="bg-emerald-50 rounded-2xl p-6 md:p-8 text-center shadow-sm border border-emerald-100">
                <h2 className="text-2xl md:text-3xl font-bold text-emerald-800 mb-2">Casal em Dias</h2>
                <p className="text-emerald-700 text-lg md:text-xl font-medium">Organizar o dinheiro em casal não precisa ser motivo de briga.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Renda Total" value={formatCurrency(totals.income)} color="text-emerald-600" icon={<WalletIcon />} />
                <StatCard label="Despesas Fixas" value={formatCurrency(totals.fixed)} color="text-orange-600" icon={<MoneyIcon />} />
                <StatCard label="Despesas Variáveis" value={formatCurrency(totals.variable)} color="text-red-600" icon={<ShoppingBagIcon />} />
                <StatCard
                    label="Saldo do Mês"
                    value={formatCurrency(totals.balance)}
                    color={totals.balance >= 0 ? "text-emerald-600" : "text-red-600"}
                    icon={<PieChartIcon />}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Sobrou este mês" className="h-full">
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-2">
                            <PigIcon className="w-10 h-10" />
                        </div>
                        <div className="text-4xl font-bold text-slate-900 tracking-tight">{formatCurrency(totals.balance > 0 ? totals.balance : 0)}</div>
                        <p className="text-slate-500 mb-6">Dinheiro livre para investir ou guardar</p>

                        {feedback && feedback.type === 'success' && currentView === ViewState.DASHBOARD && (
                            <div className="mb-4 w-full"><FeedbackMessage message={feedback.message} type={feedback.type} /></div>
                        )}

                        {!currentMonthData.closed ? (
                            <Button onClick={handleCloseMonth} disabled={totals.balance <= 0} className="w-full sm:w-auto px-8">
                                Guardar na Caixinha
                            </Button>
                        ) : (
                            <div className="inline-flex items-center text-emerald-700 bg-emerald-50 px-6 py-3 rounded-xl font-medium border border-emerald-100">
                                <span className="mr-2">✓</span> Enviado para Caixinha
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Últimas Compras" className="h-full">
                    {currentMonthData.expenses.filter(e => e.type === 'variable').length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <EmptyState
                                title="Nenhuma compra recente"
                                description="Suas compras variáveis aparecerão aqui."
                                icon={<ShoppingBagIcon className="w-8 h-8 opacity-50" />}
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-slate-500 uppercase font-medium text-xs">
                                    <tr>
                                        <th className="px-4 py-3 bg-slate-50 rounded-l-lg">Data</th>
                                        <th className="px-4 py-3 bg-slate-50">Descrição</th>
                                        <th className="px-4 py-3 bg-slate-50 text-right rounded-r-lg">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {currentMonthData.expenses
                                        .filter(e => e.type === 'variable')
                                        .slice(-5)
                                        .map(e => (
                                            <tr key={e.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 text-slate-500">{new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    {e.name}
                                                    <span className="block text-xs text-slate-400 font-normal">{e.category}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(e.value)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            <div className="flex justify-end">
                <Button variant="danger" onClick={handleResetMonth} className="text-sm">
                    <TrashIcon className="w-4 h-4 mr-2" /> Começar este mês do zero
                </Button>
            </div>
        </div>
    );

    const renderSalaries = () => (
        <div className="max-w-xl mx-auto">
            <Card title="Quanto vocês ganham?" subtitle="Informe a renda de cada um para começarmos.">
                <div className="space-y-6 mt-4">
                    <Input
                        label="Salário 1"
                        type="number"
                        value={salaryForm.salary1}
                        onChange={(e) => handleSalaryChange('salary1', e.target.value)}
                        placeholder="0.00"
                    />
                    <Input
                        label="Salário 2"
                        type="number"
                        value={salaryForm.salary2}
                        onChange={(e) => handleSalaryChange('salary2', e.target.value)}
                        placeholder="0.00"
                    />

                    {feedback && (
                        <FeedbackMessage message={feedback.message} type={feedback.type} />
                    )}

                    <Button className="w-full h-12 text-lg shadow-emerald-200 mt-2" onClick={handleSaveSalaries}>
                        Atualizar Salários
                    </Button>

                    <div className="pt-6 border-t border-slate-50 mt-6">
                        <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <span className="font-semibold text-emerald-800">Total Mensal</span>
                            <span className="text-2xl font-bold text-emerald-600">
                                {formatCurrency((Number(salaryForm.salary1) || 0) + (Number(salaryForm.salary2) || 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );

    const renderExpenses = (type: ExpenseType) => {
        const list = currentMonthData.expenses.filter(e => e.type === type);
        const title = type === 'fixed' ? 'Despesas Fixas' : 'Despesas Variáveis';
        const subtitle = type === 'fixed' ? 'Contas que chegam todo mês (Aluguel, Internet...)' : 'Gastos do dia a dia (Mercado, Lazer...)';

        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    {type === 'fixed' && (
                        <Button variant="secondary" onClick={handleImportFixedExpenses} className="text-sm">
                            Copiar do mês passado
                        </Button>
                    )}
                </div>

                <Card className="bg-white border-emerald-100 shadow-sm" title={editingExpense ? `Editar ${title}` : `Adicionar ${title}`}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        {type === 'variable' && (
                            <div className="md:col-span-3">
                                <Input
                                    label="Data"
                                    type="date"
                                    value={expenseForm.date}
                                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                                />
                            </div>
                        )}
                        <div className={type === 'variable' ? "md:col-span-4" : "md:col-span-6"}>
                            <Input
                                label="Nome do Gasto"
                                placeholder="Ex: Internet, Jantar..."
                                value={expenseForm.name}
                                onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                            />
                        </div>
                        {type === 'variable' && (
                            <div className="md:col-span-3">
                                <Select
                                    label="Categoria"
                                    value={expenseForm.category}
                                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <Input
                                label="Valor"
                                type="number"
                                placeholder="0.00"
                                value={expenseForm.value}
                                onChange={(e) => setExpenseForm({ ...expenseForm, value: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-12 flex justify-end mt-4 pt-4 border-t border-slate-50">
                            {editingExpense ? (
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => {
                                        setEditingExpense(null);
                                        setExpenseForm({ name: '', value: '', category: 'Outros', date: new Date().toISOString().split('T')[0] });
                                    }}>Cancelar</Button>
                                    <Button onClick={handleUpdateExpense}>Salvar Alteração</Button>
                                </div>
                            ) : (
                                <Button onClick={() => handleAddExpense(type)} disabled={!expenseForm.name || !expenseForm.value}>
                                    <PlusIcon className="mr-2" /> Adicionar
                                </Button>
                            )}
                        </div>
                    </div>
                    {feedback && (
                        <FeedbackMessage message={feedback.message} type={feedback.type} />
                    )}
                </Card>

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-2 mb-2">
                        <h3 className="font-semibold text-slate-700">{list.length} Registros</h3>
                        <span className="font-bold text-lg text-slate-900">Total: {formatCurrency(list.reduce((acc, curr) => acc + curr.value, 0))}</span>
                    </div>

                    {list.length === 0 && (
                        <EmptyState
                            title={type === 'fixed' ? "Tudo tranquilo por aqui" : "Nenhum gasto extra"}
                            description={type === 'fixed' ? "Não há despesas fixas cadastradas neste mês." : "Você ainda não registrou gastos variáveis."}
                            actionLabel="Adicionar agora"
                            onAction={() => {
                                setEditingExpense(null);
                                setExpenseForm({ name: '', value: '', category: 'Outros', date: new Date().toISOString().split('T')[0] });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            icon={type === 'fixed' ? <MoneyIcon className="w-8 h-8" /> : <ShoppingBagIcon className="w-8 h-8" />}
                        />
                    )}

                    {list.map(expense => (
                        <div key={expense.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-emerald-300 hover:shadow-md transition-all">
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h4 className="font-semibold text-slate-800">{expense.name}</h4>
                                    {type === 'variable' && (
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">{expense.category}</span>
                                    )}
                                </div>
                                {type === 'variable' && <p className="text-xs text-slate-400 mt-1">{new Date(expense.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                            </div>
                            <div className="flex items-center gap-6">
                                <span className="font-bold text-slate-700 text-lg">{formatCurrency(expense.value)}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditClick(expense)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                        <EditIcon />
                                    </button>
                                    <button onClick={() => handleDeleteExpense(expense.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderCaixinha = () => (
        <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
            <Card title="Caixinha Acumulada">
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="p-6 bg-emerald-100 text-emerald-600 rounded-full inline-flex mb-6 shadow-sm">
                            <WalletIcon className="w-12 h-12" />
                        </div>
                        <p className="text-slate-500 font-medium text-lg">Você já economizou</p>
                        <h2 className="text-5xl font-bold text-emerald-700 mt-3 tracking-tight">{formatCurrency(totalSavings)}</h2>
                        <p className="text-slate-400 mt-4 max-w-xs mx-auto text-sm">
                            Este valor representa a soma dos saldos positivos de meses que já foram fechados.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );

    const renderChangePasswordModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <Card title="Alterar Senha" className="w-full max-w-md shadow-2xl relative border-none">
                <button
                    onClick={() => { setIsPasswordModalOpen(false); setPasswordFeedback(null); setNewPassword(''); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="space-y-4 mt-2">
                    <p className="text-slate-500 text-sm">Digite sua nova senha abaixo para atualizar seu acesso.</p>
                    <Input
                        label="Nova Senha"
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordLoading}
                    />

                    {passwordFeedback && (
                        <FeedbackMessage type={passwordFeedback.type} message={passwordFeedback.message} />
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsPasswordModalOpen(false)} className="w-full h-11">
                            Cancelar
                        </Button>
                        <Button onClick={handleChangePassword} disabled={!newPassword || passwordLoading} className="w-full h-11 shadow-emerald-200">
                            {passwordLoading ? 'Salvando...' : 'Atualizar Senha'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );



    const NavItem = ({ view, label, icon }: { view: ViewState, label: string, icon: React.ReactNode }) => (
        <button
            onClick={() => setCurrentView(view)}
            className={`flex flex-col md:flex-row items-center justify-center md:gap-2 px-3 py-2 md:px-4 md:py-3 rounded-xl transition-all text-xs md:text-sm font-medium ${currentView === view ? 'bg-emerald-600 text-white shadow-md transform scale-105' : 'text-slate-600 hover:bg-slate-100 hover:text-emerald-700'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    // --- Early Return for Auth ---
    if (authLoading) return <div className="flex items-center justify-center h-screen text-slate-500">Carregando...</div>;

    if (!user) {
        return <AuthScreen onLogin={setUser} />;
    }

    if (dataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                <p className="text-slate-600 font-medium">Carregando finanças...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">

            {/* Top Header */}
            <header className="bg-emerald-700 text-white pt-6 pb-12 px-4 md:px-8 shadow-lg">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/20">
                            <PigIcon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Casal em Dias</h1>
                            <div className="flex items-center text-emerald-100 text-sm font-medium opacity-90">
                                <span className="bg-white/10 px-2 py-0.5 rounded text-xs uppercase tracking-wide mr-2">Atual</span>
                                {currentMonthData.label}
                            </div>
                        </div>
                    </div>

                    {/* Header Right: Balance + User Profile */}
                    <div className="flex flex-col items-end gap-3">
                        {/* User Info & Logout */}
                        <div className="flex items-center gap-3 bg-emerald-800/30 pl-4 pr-1 py-1 rounded-full border border-emerald-600/30">
                            <span className="text-sm font-medium text-emerald-50 truncate max-w-[150px]">{user.name}</span>

                            {/* Save Status Indicator */}
                            {saveStatus === 'saving' && (
                                <span className="text-xs text-emerald-200 flex items-center gap-1 mr-2">
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Salvando...
                                </span>
                            )}
                            {saveStatus === 'saved' && (
                                <span className="text-xs text-emerald-200 flex items-center gap-1 mr-2">
                                    ✓ Salvo
                                </span>
                            )}
                            {saveStatus === 'error' && (
                                <span className="text-xs text-red-300 flex items-center gap-1 mr-2">
                                    ⚠ Erro
                                </span>
                            )}

                            <button onClick={() => setIsPasswordModalOpen(true)} className="p-1.5 bg-emerald-900/50 hover:bg-emerald-600 rounded-full transition-colors mr-1" title="Alterar Senha">
                                <svg className="w-4 h-4 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            </button>
                            <button onClick={handleRestartOnboarding} className="p-1.5 bg-emerald-900/50 hover:bg-emerald-600 rounded-full transition-colors mr-1" title="Reiniciar Tutorial">
                                <svg className="w-4 h-4 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </button>
                            <button onClick={handleLogout} className="p-1.5 bg-emerald-900/50 hover:bg-red-500/80 rounded-full transition-colors" title="Sair">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        </div>

                        {/* Balance (Only if not in month selection) */}
                        {currentView !== ViewState.MONTH_SELECTION && (
                            <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-6 py-3 rounded-xl flex flex-col items-end">
                                <span className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Saldo em {currentMonthData.label.split(' ')[0]}</span>
                                <span className="text-2xl font-bold">{formatCurrency(totals.balance)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Navigation Bar - Overlapping Header */}
            <div className="px-4 md:px-8 -mt-8">
                <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-2 overflow-x-auto">
                    <div className="flex justify-between md:justify-start gap-1 md:gap-2 min-w-max">
                        <NavItem view={ViewState.MONTH_SELECTION} label="Mês" icon={<CalendarIcon className="w-5 h-5" />} />
                        <div className="w-px bg-slate-200 mx-2 my-2 hidden md:block"></div>
                        <NavItem view={ViewState.SALARIES} label="Salários" icon={<WalletIcon className="w-5 h-5" />} />
                        <NavItem view={ViewState.EXPENSES_FIXED} label="Fixas" icon={<MoneyIcon className="w-5 h-5" />} />
                        <NavItem view={ViewState.EXPENSES_VARIABLE} label="Variáveis" icon={<ShoppingBagIcon className="w-5 h-5" />} />
                        <NavItem view={ViewState.DASHBOARD} label="Resumo" icon={<PieChartIcon className="w-5 h-5" />} />
                        <div className="w-px bg-slate-200 mx-2 my-2 hidden md:block"></div>
                        <NavItem view={ViewState.CAIXINHA} label="Caixinha" icon={<PigIcon className="w-5 h-5" />} />


                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="px-4 md:px-8 mt-8">
                <div className="max-w-6xl mx-auto">
                    {currentView === ViewState.MONTH_SELECTION && renderMonthSelection()}
                    {currentView === ViewState.DASHBOARD && renderDashboard()}
                    {currentView === ViewState.SALARIES && renderSalaries()}
                    {currentView === ViewState.EXPENSES_FIXED && renderExpenses('fixed')}
                    {currentView === ViewState.EXPENSES_VARIABLE && renderExpenses('variable')}
                    {currentView === ViewState.CAIXINHA && renderCaixinha()}

                </div>
            </main>
            {/* Onboarding Banner */}
            {
                onboardingStep > 0 && (
                    <OnboardingBanner
                        step={onboardingStep}
                        totalSteps={3}
                        title={
                            onboardingStep === 1 ? "Vamos começar?" :
                                onboardingStep === 2 ? "Cadastre suas contas" :
                                    "Tudo sob controle!"
                        }
                        description={
                            onboardingStep === 1 ? "Primeiro, informe quanto vocês ganham para definirmos o orçamento do mês." :
                                onboardingStep === 2 ? "Adicione suas despesas fixas (Aluguel, Luz) e variáveis (Mercado, Lazer)." :
                                    "Acompanhe aqui o resultado do mês e veja quanto sobra para realizar sonhos."
                        }
                        onNext={handleNextOnboarding}
                        onSkip={handleSkipOnboarding}
                    />
                )
            }


            {isPasswordModalOpen && renderChangePasswordModal()}
        </div >
    );
};

export default App;