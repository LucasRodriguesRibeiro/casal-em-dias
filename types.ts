export type ExpenseType = 'fixed' | 'variable';

export interface Expense {
  id: string;
  name: string;
  value: number;
  category: string;
  date: string; // ISO string YYYY-MM-DD
  type: ExpenseType;
}

export interface MonthData {
  id: string; // Format: YYYY-MM
  label: string; // Format: Janeiro 2025
  salary1: number;
  salary2: number;
  expenses: Expense[];
  closed: boolean; // If true, balance was sent to Caixinha
}

export interface AppState {
  months: MonthData[];
  currentMonthId: string;
}

export enum ViewState {
  MONTH_SELECTION = 'MONTH_SELECTION',
  DASHBOARD = 'DASHBOARD',
  SALARIES = 'SALARIES',
  EXPENSES_FIXED = 'EXPENSES_FIXED',
  EXPENSES_VARIABLE = 'EXPENSES_VARIABLE',
  CAIXINHA = 'CAIXINHA',
}
