"""Simple linear regression (ordinary least squares) over a spending history.

The "machine learning" here is deliberately small and explainable: fit a straight line
y = intercept + slope · x to the variable spending of past periods (x = 0, 1, 2…) and
extend it into the future. With little data a line can be misleading, so callers fall
back to the plain average below MIN_POINTS.
"""

from dataclasses import dataclass
from decimal import Decimal

MIN_POINTS = 3


@dataclass(frozen=True)
class LinearFit:
    slope: Decimal
    intercept: Decimal
    # Coefficient of determination: 1 = the line explains the data perfectly, 0 = not at all
    r_squared: Decimal

    def predict(self, x: int) -> Decimal:
        return self.intercept + self.slope * x


def fit_line(values: list[Decimal]) -> LinearFit:
    """Least-squares line through (0, values[0]), (1, values[1]), …"""
    n = len(values)
    if n < 2:
        raise ValueError("need at least two points to fit a line")
    xs = [Decimal(x) for x in range(n)]
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values, strict=True))
    slope = sxy / sxx
    intercept = mean_y - slope * mean_x

    total = sum((y - mean_y) ** 2 for y in values)
    residual = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(xs, values, strict=True))
    # A flat history is explained perfectly by a flat line
    r_squared = Decimal(1) if total == 0 else 1 - residual / total
    return LinearFit(slope=slope, intercept=intercept, r_squared=r_squared)
