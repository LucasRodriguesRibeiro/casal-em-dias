import { MonthData, Expense } from '../types';
import { MONTH_NAMES } from '../constants';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const parseCurrency = (value: string): number => {
  return Number(value.replace(/[^0-9,-]+/g, "").replace(",", "."));
};

export const getMonthLabel = (date: Date): string => {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

export const generateMonthId = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const calculateTotals = (monthData: MonthData | undefined) => {
  if (!monthData) return { income: 0, fixed: 0, variable: 0, totalExpenses: 0, balance: 0 };

  const income = monthData.salary1 + monthData.salary2;
  const fixed = monthData.expenses
    .filter(e => e.type === 'fixed')
    .reduce((acc, curr) => acc + curr.value, 0);
  const variable = monthData.expenses
    .filter(e => e.type === 'variable')
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalExpenses = fixed + variable;
  const balance = income - totalExpenses;

  return { income, fixed, variable, totalExpenses, balance };
};

export const calculateAccumulatedSavings = (months: MonthData[]): number => {
  return months
    .filter(m => m.closed) // Only closed months
    .reduce((acc, m) => {
      const { balance } = calculateTotals(m);
      return acc + (balance > 0 ? balance : 0); // Only positive balances
    }, 0);
};

// --- BACKEND ABSTRACTION LAYER ---

const STORAGE_KEY_PREFIX = 'financas_casal_data_';

export const FinanceAPI = {
  /**
   * Simulates fetching data from a backend API.
   * Replace the body of this function with a real fetch/axios call later.
   */
  getMonths: async (userId: string): Promise<MonthData[]> => {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 600));

    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Simulates saving data to a backend API.
   * In a real app, you might want to save individual months instead of the whole array.
   */
  saveMonths: async (userId: string, months: MonthData[]): Promise<void> => {
    // In a real app, this would be await fetch('api/months', { method: 'POST', ... })
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(months));
    return Promise.resolve();
  }
};