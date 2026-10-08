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
  estimator: Estimator;
  trend_per_period: Money | null;
  trend_r_squared: string | null;
  history_points: number;
  periods: ForecastPeriod[];
};

export type Estimator = "average" | "trend";

export type SavingsGoalInput = {
  name: string;
  target_amount: Money;
  saved_amount: Money;
  due_date: string | null;
};

export type SavingsGoal = SavingsGoalInput & {
  id: string;
  remaining: Money;
  progress_percent: number;
  completed: boolean;
  overdue: boolean;
  periods_left: number | null;
  suggested_per_period: Money | null;
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

export type LimitStatus = "none" | "ok" | "warning" | "over";

export type CategorySpending = {
  category_id: string | null;
  name: string;
  color: string | null;
  amount: Money;
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
  limit_status: LimitStatus;
  previous_period_start: string;
  previous_period_end: string;
  previous_income: Money;
  previous_spent: Money;
  spending_by_category: CategorySpending[];
  series: SeriesPoint[];
  upcoming_fixed_expenses: UpcomingFixedExpense[];
  recent_transactions: Transaction[];
};

/**
 * Request bodies with only the fields the API accepts. The API rejects unknown fields
 * (`extra="forbid"`), so a row as returned by the API (id, timestamps…) can't be sent back.
 */
export function incomePayload(
  item: Income,
  changes: Partial<IncomeInput & { is_active: boolean }> = {},
) {
  const { label, amount, frequency, custom_period_days, start_date, is_active } = {
    ...item,
    ...changes,
  };
  return { label, amount, frequency, custom_period_days, start_date, is_active };
}

export function fixedExpensePayload(
  item: FixedExpense,
  changes: Partial<FixedExpenseInput & { is_active: boolean }> = {},
) {
  const {
    name,
    amount,
    frequency,
    custom_period_days,
    start_date,
    due_day,
    category_id,
    is_active,
  } = {
    ...item,
    ...changes,
  };
  return {
    name,
    amount,
    frequency,
    custom_period_days,
    start_date,
    due_day,
    category_id,
    is_active,
  };
}

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
    category_id?: string;
    limit?: number;
    offset?: number;
  }) => request<TransactionPage>(`/transactions${query(params)}`),
  createTransaction: (data: TransactionInput) =>
    request<Transaction>("/transactions", { method: "POST", body: data }),
  updateTransaction: (id: string, data: TransactionInput) =>
    request<Transaction>(`/transactions/${id}`, { method: "PUT", body: data }),
  deleteTransaction: (id: string) => request<void>(`/transactions/${id}`, { method: "DELETE" }),

  getForecast: (
    periods: number,
    period: DashboardPeriod | undefined,
    date: string,
    estimator: Estimator = "average",
  ) => request<Forecast>(`/forecast${query({ periods, period, date, estimator })}`),

  listGoals: (date: string) => request<SavingsGoal[]>(`/savings-goals${query({ date })}`),
  createGoal: (data: SavingsGoalInput) =>
    request<SavingsGoal>("/savings-goals", { method: "POST", body: data }),
  updateGoal: (id: string, data: SavingsGoalInput) =>
    request<SavingsGoal>(`/savings-goals/${id}`, { method: "PUT", body: data }),
  deleteGoal: (id: string) => request<void>(`/savings-goals/${id}`, { method: "DELETE" }),
  contribute: (id: string, amount: Money) =>
    request<SavingsGoal>(`/savings-goals/${id}/contributions`, {
      method: "POST",
      body: { amount },
    }),

  /** URL of the CSV download (a plain GET: the browser sends the session cookie). */
  exportUrl: (params: {
    from?: string;
    to?: string;
    type?: TransactionType;
    category_id?: string;
  }) => `/api/v1/transactions/export${query(params)}`,

  getDashboard: (period: DashboardPeriod, date: string) =>
    request<Dashboard>(`/dashboard${query({ period, date })}`),
};
