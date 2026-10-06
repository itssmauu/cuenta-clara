from enum import StrEnum


class Frequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class TransactionType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"
