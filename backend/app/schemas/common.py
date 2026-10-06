from decimal import Decimal
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models import Frequency

# NUMERIC(12, 2): up to 9,999,999,999.99. Serialized as a string ("160.00") so no
# client ever parses money into a binary float.
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
NonNegativeMoney = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]

CustomPeriodDays = Annotated[int, Field(ge=1, le=366)]

# Trimmed, non-empty strings sized to their database columns
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]


class InputModel(BaseModel):
    # Unknown fields are an error, so nobody can sneak in `user_id` or `id`
    model_config = ConfigDict(extra="forbid")


class OutputModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FrequencyFields(InputModel):
    """Shared by anything with a frequency: `custom` needs a day count, others must not have one."""

    frequency: Frequency
    custom_period_days: CustomPeriodDays | None = None

    @model_validator(mode="after")
    def _custom_period_days_iff_custom(self) -> Self:
        if self.frequency == Frequency.CUSTOM and self.custom_period_days is None:
            raise ValueError("Con frecuencia personalizada indica cada cuántos días.")
        if self.frequency != Frequency.CUSTOM and self.custom_period_days is not None:
            raise ValueError("Los días solo aplican a la frecuencia personalizada.")
        return self
