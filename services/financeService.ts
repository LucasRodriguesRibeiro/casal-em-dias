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

// --- BACKEND ABSTRACTION LAYER (SUPABASE) ---
import { supabase } from './supabaseClient';

export const FinanceAPI = {
  /**
   * Fetches full month data from Supabase including salaries and expenses.
   */
  getMonths: async (userId: string): Promise<MonthData[]> => {
    // 1. Fetch Months
    const { data: monthsData, error: monthsError } = await supabase
      .from('months')
      .select('*')
      .eq('user_id', userId);

    if (monthsError) {
      console.error("Error fetching months:", monthsError);
      throw monthsError;
    }
    if (!monthsData || monthsData.length === 0) return [];

    // 2. Fetch Expenses for these months
    const monthIds = monthsData.map(m => m.id);
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .in('month_id', monthIds);

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError);
      throw expensesError;
    }

    // 3. Reconstruct MonthData structure
    const joinedMonths: MonthData[] = monthsData.map(m => {
      const monthExpenses = expensesData
        ? expensesData.filter(e => e.month_id === m.id)
        : [];

      return {
        id: m.month_code, // Use month_code (YYYY-MM) as ID in app state
        label: m.label,
        salary1: Number(m.salary1),
        salary2: Number(m.salary2),
        expenses: monthExpenses.map(e => ({
          id: e.id,
          name: e.name,
          value: Number(e.value),
          category: e.category,
          date: e.date,
          type: e.type as "fixed" | "variable"
        })),
        closed: m.closed
      };
    });

    return joinedMonths;
  },

  /**
   * Upserts month data. 
   * CAUTION: This implementation does a full sync (upsert month, upsert salaries, upsert expenses).
   * For the "Save" feature, this is acceptable for now.
   */
  saveMonths: async (userId: string, months: MonthData[]): Promise<void> => {
    // Loop through each month to save (Inefficient for bulk, but safe for app usage)
    for (const month of months) {
      // 1. Upsert Month Record
      const { data: savedMonth, error: monthError } = await supabase
        .from('months')
        .upsert({
          user_id: userId,
          month_code: month.id,
          label: month.label,
          salary1: month.salary1,
          salary2: month.salary2,
          closed: month.closed
        }, { onConflict: 'user_id, month_code' }) // Requires unique constraint or index if not PK
        .select()
        .single();

      if (monthError) {
        console.error("Error saving month:", monthError);
        continue;
      }

      if (!savedMonth) continue;

      const monthUUID = savedMonth.id;

      // 2. Sync Expenses
      // Strategy: Delete all for this month and re-insert. 
      // This allows handling deletions without complex tracking.
      // Might strictly require Row Level Security policies to be safe.

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('month_id', monthUUID);

      if (deleteError) {
        console.error("Error clearing expenses for sync:", deleteError);
        // Don't stop, try to insert anyway/handle error
      }

      if (month.expenses.length > 0) {
        const expensesToInsert = month.expenses.map(e => ({
          // id: e.id, // Let Supabase generate new IDs to avoid conflicts or just use the UI-generated ones if valid UUIDs? 
          // Better: Let's assume UI generates valid UUIDs, but if we delete-reinsert, fresh IDs might be safer unless we strictly need to keep them.
          // For this MVP refactor, let's let Supabase generate new IDs or use provided ones if we were doing true upsert.
          // Since we delete all, we can just insert.
          user_id: userId,
          month_id: monthUUID,
          name: e.name,
          value: e.value,
          category: e.category,
          date: e.date,
          type: e.type
        }));

        const { error: insertError } = await supabase
          .from('expenses')
          .insert(expensesToInsert);

        if (insertError) console.error("Error inserting expenses:", insertError);
      }
    }
  },

  /**
   * Saves a single month efficiently (optimized for auto-save).
   * Uses upsert for expenses instead of delete+insert to prevent data loss.
   */
  saveMonth: async (userId: string, month: MonthData): Promise<void> => {
    // 1. Upsert Month Record
    const { data: savedMonth, error: monthError } = await supabase
      .from('months')
      .upsert({
        user_id: userId,
        month_code: month.id,
        label: month.label,
        salary1: month.salary1,
        salary2: month.salary2,
        closed: month.closed
      }, { onConflict: 'user_id, month_code' })
      .select()
      .single();

    if (monthError) {
      console.error("Error saving month:", monthError);
      throw monthError;
    }

    if (!savedMonth) return;

    const monthUUID = savedMonth.id;

    // 2. Sync Expenses Intelligently
    // Fetch existing expenses for this month
    const { data: existingExpenses, error: fetchError } = await supabase
      .from('expenses')
      .select('id')
      .eq('month_id', monthUUID);

    if (fetchError) {
      console.error("Error fetching expenses:", fetchError);
      throw fetchError;
    }

    const existingIds = new Set((existingExpenses || []).map(e => e.id));
    const currentIds = new Set(month.expenses.map(e => e.id));

    // Delete expenses that were removed
    const toDelete = [...existingIds].filter(id => !currentIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .in('id', toDelete);

      if (deleteError) console.error("Error deleting expenses:", deleteError);
    }

    // Upsert current expenses (insert new, update existing)
    if (month.expenses.length > 0) {
      const expensesToUpsert = month.expenses.map(e => ({
        id: e.id, // Keep UI-generated UUID
        user_id: userId,
        month_id: monthUUID,
        name: e.name,
        value: e.value,
        category: e.category,
        date: e.date,
        type: e.type
      }));

      const { error: upsertError } = await supabase
        .from('expenses')
        .upsert(expensesToUpsert, { onConflict: 'id' });

      if (upsertError) {
        console.error("Error upserting expenses:", upsertError);
        throw upsertError;
      }
    }
  }
};