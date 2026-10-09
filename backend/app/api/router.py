from fastapi import APIRouter

from app.api import (
    accounts,
    auth,
    categories,
    dashboard,
    fixed_expenses,
    health,
    incomes,
    reports,
    savings_goals,
    settings,
    transactions,
    transfers,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(settings.router)
api_router.include_router(accounts.router)
api_router.include_router(transfers.router)
api_router.include_router(categories.router)
api_router.include_router(incomes.router)
api_router.include_router(fixed_expenses.router)
api_router.include_router(transactions.router)
api_router.include_router(dashboard.router)
api_router.include_router(savings_goals.router)
api_router.include_router(reports.router)
