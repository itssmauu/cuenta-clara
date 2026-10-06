/** Typed calls for settings, categories, recurring items, transactions and the dashboard. */
import { request } from "./api";

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "custom";
export type DashboardPeriod = Exclude<Frequency, "custom">;
export type TransactionType = "income" | "expense";
/** Money travels as a string with two decimals, e.g. "160.00" */
export type Money = string;

export type Settings = {
  initial_balance: Money;
  balance_as_of: string;
  currency: string;
  income_period: Frequency;
  custom_period_days: number | null;
  spending_limit: Money | null;
  onboarding_completed: boolean;
};

export type Category = { id: string; name: string; color: string; is_default: boolean };

export type IncomeInput = {
  label: string;
  amount: Money;
  frequency: Frequency;
  custom_period_days?: number | null;
  start_date: string;
};

export type FixedExpenseInput = {
  name: string;
  amount: Money;
  frequency: Frequency;
  custom_period_days?: number | null;
  start_date: string;
  due_day?: number | null;
  category_id?: string | null;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: Money;
  category_id: string | null;
  occurred_on: string;
  note: string | null;
};

export type TransactionInput = Omit<Transaction, "id">;

export type Income = IncomeInput & {
  id: string;
  custom_period_days: number | null;
  is_active: boolean;
};

export type FixedExpense = FixedExpenseInput & {
  id: string;
  custom_period_days: number | null;
  due_day: number | null;
  category_id: string | null;
  is_active: boolean;
};

export type ForecastPeriod = {
  period_start: string;
  period_end: string;
  opening_balance: Money;
  income: Money;
  fixed_expenses: Money;
  variable_spending: Money;
  closing_balance: Money;
  is_current: boolean;
};

export type Forecast = {
  period: Frequency;
  currency: string;
  average_variable_spending: Money;
  periods: ForecastPeriod[];
};

export type TransactionPage = {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
};

export type SeriesPoint = {
  period_start: string;
  period_end: string;
  spent: Money;
  limit: Money | null;
  over_limit: boolean;
};

export type UpcomingFixedExpense = {
  id: string;
  name: string;
  amount: Money;
  due_on: string;
  category_id: string | null;
};

export type Dashboard = {
  period: Frequency;
  period_start: string;
  period_end: string;
  currency: string;
  initial_balance: Money;
  balance_as_of: string;
  opening_balance: Money;
  income: Money;
  fixed_expenses: Money;
  variable_expenses: Money;
  spent: Money;
  available_balance: Money;
  spending_limit: Money | null;
  limit_remaining: Money | null;
  limit_used_percent: number | null;
  over_limit: boolean;
  series: SeriesPoint[];
  upcoming_fixed_expenses: UpcomingFixedExpense[];
  recent_transactions: Transaction[];
};

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const financeApi = {
  getSettings: () => request<Settings>("/settings"),
  saveSettings: (
    data: Omit<Settings, "custom_period_days"> & { custom_period_days?: number | null },
  ) => request<Settings>("/settings", { method: "PUT", body: data }),

  listCategories: () => request<Category[]>("/categories"),
  createCategory: (data: { name: string; color: string }) =>
    request<Category>("/categories", { method: "POST", body: data }),
  updateCategory: (id: string, data: { name: string; color: string }) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: data }),
  deleteCategory: (id: string) => request<void>(`/categories/${id}`, { method: "DELETE" }),

  listIncomes: () => request<Income[]>("/incomes"),
  createIncome: (data: IncomeInput) => request<Income>("/incomes", { method: "POST", body: data }),
  updateIncome: (id: string, data: IncomeInput & { is_active: boolean }) =>
    request<Income>(`/incomes/${id}`, { method: "PUT", body: data }),
  deleteIncome: (id: string) => request<void>(`/incomes/${id}`, { method: "DELETE" }),

  listFixedExpenses: () => request<FixedExpense[]>("/fixed-expenses"),
  createFixedExpense: (data: FixedExpenseInput) =>
    request<FixedExpense>("/fixed-expenses", { method: "POST", body: data }),
  updateFixedExpense: (id: string, data: FixedExpenseInput & { is_active: boolean }) =>
    request<FixedExpense>(`/fixed-expenses/${id}`, { method: "PUT", body: data }),
  deleteFixedExpense: (id: string) => request<void>(`/fixed-expenses/${id}`, { method: "DELETE" }),

  listTransactions: (params: {
    from?: string;
    to?: string;
    type?: TransactionType;
    limit?: number;
    offset?: number;
  }) => request<TransactionPage>(`/transactions${query(params)}`),
  createTransaction: (data: TransactionInput) =>
    request<Transaction>("/transactions", { method: "POST", body: data }),
  updateTransaction: (id: string, data: TransactionInput) =>
    request<Transaction>(`/transactions/${id}`, { method: "PUT", body: data }),
  deleteTransaction: (id: string) => request<void>(`/transactions/${id}`, { method: "DELETE" }),

  getForecast: (periods: number, period: DashboardPeriod | undefined, date: string) =>
    request<Forecast>(`/forecast${query({ periods, period, date })}`),

  getDashboard: (period: DashboardPeriod, date: string) =>
    request<Dashboard>(`/dashboard${query({ period, date })}`),
};
