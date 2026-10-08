from fastapi import APIRouter

from app.api import (
    auth,
    categories,
    dashboard,
    fixed_expenses,
    health,
    incomes,
    savings_goals,
    settings,
    transactions,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(settings.router)
api_router.include_router(categories.router)
api_router.include_router(incomes.router)
api_router.include_router(fixed_expenses.router)
api_router.include_router(transactions.router)
api_router.include_router(dashboard.router)
api_router.include_router(savings_goals.router)
