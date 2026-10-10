"""Request/response models for settings, accounts, categories, money movements and goals."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import AfterValidator, Field, StringConstraints, computed_field, model_validator

from app.models import AccountKind, Frequency, TransactionType
from app.schemas.common import (
    CustomPeriodDays,
    FrequencyFields,
    HexColor,
    InputModel,
    Label,
    NonNegativeMoney,
    Note,
    OutputModel,
    PositiveMoney,
    ShortText,
)

# ── Settings ────────────────────────────────────────────


class SettingsIn(InputModel):
    # The day the accounts' initial balances were true (the client sends its local date)
    balance_as_of: date
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] = "USD"
    income_period: Frequency
    custom_period_days: CustomPeriodDays | None = None
    spending_limit: NonNegativeMoney | None = None
    onboarding_completed: bool = False

    @model_validator(mode="after")
    def _custom_period_days_iff_custom(self) -> Self:
        if (self.income_period == Frequency.CUSTOM) != (self.custom_period_days is not None):
            raise ValueError("Indica los días solo cuando el periodo de ingreso es personalizado.")
        return self


class SettingsOut(OutputModel):
    balance_as_of: date
    currency: str
    income_period: Frequency
    custom_period_days: int | None
    spending_limit: Decimal | None
    onboarding_completed: bool


# ── Accounts ────────────────────────────────────────────

# More digits than this in a name looks like an account or card number
MAX_DIGITS_IN_ACCOUNT_NAME = 5


def _no_account_number(name: str) -> str:
    """The app only needs a name to tell accounts apart; never store bank numbers."""
    if sum(char.isdigit() for char in name) > MAX_DIGITS_IN_ACCOUNT_NAME:
        raise ValueError(
            "Por tu seguridad, no escribas números de cuenta o tarjeta: "
            "usa un nombre como «Ahorro» o «Gastos del día»."
        )
    return name


AccountName = Annotated[ShortText, AfterValidator(_no_account_number)]


class AccountIn(InputModel):
    name: AccountName
    kind: AccountKind
    # What the account held on balance_as_of
    initial_balance: NonNegativeMoney = Decimal("0")
    # Making an account primary takes the role away from the previous one
    is_primary: bool = False


class AccountOut(OutputModel):
    id: uuid.UUID
    name: str
    kind: AccountKind
    initial_balance: Decimal
    is_primary: bool
    # Balance at the end of the reference day
    balance: Decimal
    created_at: datetime
    updated_at: datetime


# ── Transfers ───────────────────────────────────────────


class TransferIn(InputModel):
    from_account_id: uuid.UUID
    to_account_id: uuid.UUID
    amount: PositiveMoney
    occurred_on: date
    note: Note | None = None

    @model_validator(mode="after")
    def _two_accounts(self) -> Self:
        if self.from_account_id == self.to_account_id:
            raise ValueError("Elige dos cuentas distintas.")
        return self


class TransferOut(OutputModel):
    id: uuid.UUID
    from_account_id: uuid.UUID
    to_account_id: uuid.UUID
    amount: Decimal
    occurred_on: date
    note: str | None
    goal_id: uuid.UUID | None
    created_at: datetime


# ── Categories ──────────────────────────────────────────


class CategoryIn(InputModel):
    name: ShortText
    color: HexColor


class CategoryOut(OutputModel):
    id: uuid.UUID
    name: str
    color: str
    user_id: uuid.UUID | None = Field(exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_default(self) -> bool:
        return self.user_id is None


# ── Incomes ─────────────────────────────────────────────


class IncomeIn(FrequencyFields):
    label: Label
    amount: PositiveMoney
    start_date: date
    is_active: bool = True
    # Where it arrives. Omitted: the primary account on create, unchanged on update
    account_id: uuid.UUID | None = None


class IncomeOut(OutputModel):
    id: uuid.UUID
    label: str
    amount: Decimal
    frequency: Frequency
    custom_period_days: int | None
    start_date: date
    is_active: bool
    account_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ── Fixed expenses ──────────────────────────────────────


class FixedExpenseIn(FrequencyFields):
    name: Label
    amount: PositiveMoney
    start_date: date
    due_day: Annotated[int, Field(ge=1, le=31)] | None = None
    category_id: uuid.UUID | None = None
    is_active: bool = True
    # Paid from. Omitted: the primary account on create, unchanged on update
    account_id: uuid.UUID | None = None


class FixedExpenseOut(OutputModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    frequency: Frequency
    custom_period_days: int | None
    start_date: date
    due_day: int | None
    category_id: uuid.UUID | None
    is_active: bool
    account_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class PendingFixedExpenseOut(OutputModel):
    """A fixed expense with occurrences waiting for "did you pay it?"."""

    id: uuid.UUID
    name: str
    amount: Decimal
    frequency: Frequency
    category_id: uuid.UUID | None
    account_id: uuid.UUID
    account_name: str
    # Due days without an answer, oldest first; none of them counts until answered
    dates: list[date]


class CheckInAnswer(InputModel):
    fixed_expense_id: uuid.UUID
    occurs_on: date
    # True: paid, it counts on that day. False: not paid this time, it never counts.
    paid: bool


class CheckInsIn(InputModel):
    answers: Annotated[list[CheckInAnswer], Field(min_length=1, max_length=400)]


# ── Transactions ────────────────────────────────────────


class TransactionIn(InputModel):
    type: TransactionType
    amount: PositiveMoney
    category_id: uuid.UUID | None = None
    occurred_on: date
    note: Note | None = None
    # Omitted: the primary account on create, unchanged on update
    account_id: uuid.UUID | None = None


class TransactionOut(OutputModel):
    id: uuid.UUID
    type: TransactionType
    amount: Decimal
    category_id: uuid.UUID | None
    occurred_on: date
    note: str | None
    account_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class TransactionPage(OutputModel):
    items: list[TransactionOut]
    total: int
    limit: int
    offset: int


# ── Savings goals ───────────────────────────────────────


class SavingsGoalIn(InputModel):
    name: Label
    target_amount: PositiveMoney
    saved_amount: NonNegativeMoney = Decimal("0")
    due_date: date | None = None
    # Where the goal's money is kept. Omitted: unlinked on create, unchanged on update
    account_id: uuid.UUID | None = None


class ContributionIn(InputModel):
    # Positive = put money in; negative = take it out
    amount: Annotated[Decimal, Field(max_digits=12, decimal_places=2)]
    # The other side of the move: money leaves it (deposit) or returns to it (withdrawal).
    # Omitted, or the goal's own account: the amount is only recorded, no money moves.
    from_account_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _not_zero(self) -> Self:
        if self.amount == 0:
            raise ValueError("El monto no puede ser 0.")
        return self


class SavingsGoalOut(OutputModel):
    id: uuid.UUID
    name: str
    target_amount: Decimal
    saved_amount: Decimal
    due_date: date | None
    account_id: uuid.UUID | None
    remaining: Decimal
    progress_percent: int
    completed: bool
    overdue: bool
    periods_left: int | None
    suggested_per_period: Decimal | None
    created_at: datetime
    updated_at: datetime
