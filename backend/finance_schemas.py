from datetime import date
from pydantic import BaseModel, Field

from . import models
from .finance_models import PaymentMethod


class MembershipCatalogItem(BaseModel):
    type: models.MembershipType
    variant: str  # "GYM" | "GYM_SAUNA"
    purchase_channel: str  # "CLIENT" | "RECEPTION_ONLY"
    allowed_payment: list[PaymentMethod]


class ClientPurchaseRequest(BaseModel):
    type: models.MembershipType
    start_date: date
    with_sauna: bool
    payment_method: PaymentMethod
    price_override: int | None = Field(default=None, ge=0)


class ReceptionSellRequest(BaseModel):
    receptionist_id: int

    client_id: int | None = None

    new_client_email: str | None = None
    new_client_password: str | None = None
    new_client_first_name: str | None = None
    new_client_last_name: str | None = None
    new_client_phone_number: str | None = None
    new_client_gender: str | None = None
    new_client_birth_date: date | None = None
    new_client_address_id: int | None = None

    type: models.MembershipType
    start_date: date
    with_sauna: bool
    payment_method: PaymentMethod
    price_override: int | None = Field(default=None, ge=0)


class MembershipResponse(BaseModel):
    membership_id: int
    client_id: int
    type: models.MembershipType
    with_sauna: bool
    price: int
    start_date: date
    end_date: date
    payment_status: str
    payment_method: PaymentMethod


class ReceptionReserveRequest(BaseModel):
    receptionist_id: int
    client_id: int
    membership_id: int | None = None
