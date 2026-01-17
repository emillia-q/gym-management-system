import enum

from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func

from .models import Base

class PaymentMethod(str, enum.Enum):
    ONLINE = "ONLINE"     # płatność elektroniczna
    CASH = "CASH"         # płatność na recepcji (gotówka)


class PaymentStatus(str, enum.Enum):
    ACTIVATED = "ACTIVATED"   # "aktywowany"
    TO_PAY = "TO_PAY"         # "do opłacenia"


class MembershipPayment(Base):
    __tablename__ = "membership_payments"

    membership_id = Column(Integer, ForeignKey("memberships.id_m"), primary_key=True)
    status = Column(SAEnum(PaymentStatus), nullable=False)
    payment_method = Column(SAEnum(PaymentMethod), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReservationStatus(str, enum.Enum):
    PAID = "PAID"
    TO_PAY = "TO_PAY"


class BookGroupClassesMeta(Base):
    __tablename__ = "book_group_classes_meta"

    client_id = Column(Integer, ForeignKey("clients.id_u"), primary_key=True)
    group_classes_id = Column(Integer, ForeignKey("group_classes.id_c"), primary_key=True)

    membership_id = Column(Integer, ForeignKey("memberships.id_m"), nullable=True)
    status = Column(SAEnum(ReservationStatus), nullable=False)

    booked_by_receptionist_id = Column(Integer, ForeignKey("receptionists.id_u"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
