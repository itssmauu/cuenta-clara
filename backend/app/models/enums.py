from enum import StrEnum


class Frequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class AccountKind(StrEnum):
    """What the user keeps in an account. Only a label: no bank details are ever stored."""

    SPENDING = "spending"  # day-to-day spending
    SAVINGS = "savings"
    INVESTMENT = "investment"  # funds, investments
    OTHER = "other"


class TransactionType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"
