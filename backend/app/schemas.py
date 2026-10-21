from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class BookingInput(StrictModel):
    customer_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[0-9]{10}$", min_length=10, max_length=10)
    service_id: int = Field(gt=0, strict=True)
    date: str
    time: str


class BookingUpdate(StrictModel):
    status: Literal["Pending", "Confirmed", "Done", "Cancelled"] | None = None
    date: str | None = None
    time: str | None = None


class InvoiceLine(StrictModel):
    service_id: int = Field(gt=0, strict=True)
    quantity: int = Field(ge=1, le=20, strict=True)


class InvoiceInput(StrictModel):
    booking_id: str
    items: list[InvoiceLine] = Field(min_length=1, max_length=20)


class ChatInput(StrictModel):
    message: str = Field(min_length=1, max_length=1000)


class LoginInput(StrictModel):
    password: str = Field(min_length=1, max_length=200)
