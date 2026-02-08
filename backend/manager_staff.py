from __future__ import annotations

from datetime import date
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from . import models


router = APIRouter(prefix="/manager", tags=["Manager"])


class StaffRole(str, Enum):
    RECEPTIONIST = "RECEPTIONIST"
    INSTRUCTOR = "INSTRUCTOR"
    PERSONAL_TRAINER = "PERSONAL_TRAINER"


class AddressInline(BaseModel):
    city: str = Field(min_length=1, max_length=80)
    postal_code: str = Field(min_length=1, max_length=20)
    street_name: str = Field(min_length=1, max_length=80)
    street_number: int = Field(ge=1)
    apartment_number: int | None = Field(default=None, ge=1)


class CreateStaffRequest(BaseModel):
    # kto tworzy (tak jak macie w projekcie)
    manager_id: int = Field(ge=1)

    # kogo tworzymy
    role: StaffRole

    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    birth_date: date

    email: str = Field(min_length=3, max_length=120)
    phone_number: str = Field(min_length=3, max_length=40)  # NOT NULL
    gender: str = Field(min_length=1, max_length=1, pattern="^[FMO]$")

    # plaintext (zgodnie z tym jak działa Wasz /login)
    password: str = Field(min_length=1, max_length=200)

    contract_type: str = Field(min_length=1, max_length=40)
    salary: int | None = Field(default=None, ge=0)

    address: AddressInline


class StaffResponse(BaseModel):
    user_id: int
    role: str
    first_name: str
    last_name: str
    email: str
    phone_number: str
    contract_type: str | None = None
    hire_date: date | None = None
    salary: int | None = None
    address_id: int | None = None


def _ensure_manager(db: Session, manager_id: int) -> models.Manager:
    mgr = db.query(models.Manager).filter(models.Manager.id_u == manager_id).first()
    if not mgr:
        raise HTTPException(status_code=403, detail="Only MANAGER can perform this action.")
    return mgr


def _role_to_model(role: StaffRole):
    if role == StaffRole.RECEPTIONIST:
        return models.Receptionist, models.UserRole.RECEPTIONIST
    if role == StaffRole.INSTRUCTOR:
        return models.Instructor, models.UserRole.INSTRUCTOR
    return models.PersonalTrainer, models.UserRole.PERSONAL_TRAINER


@router.post("/staff", response_model=StaffResponse)
def create_staff(req: CreateStaffRequest, db: Session = Depends(get_db)):
    _ensure_manager(db, req.manager_id)

    # szybki check żeby ładnie zwrócić błąd
    existing = db.query(models.User).filter(models.User.email == req.email.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists.")

    # create address
    adr = models.Addresses(
        city=req.address.city.strip(),
        postal_code=req.address.postal_code.strip(),
        street_name=req.address.street_name.strip(),
        street_number=req.address.street_number,
        apartment_number=req.address.apartment_number,
    )
    db.add(adr)
    db.flush()  # get adr.id_adr

    ModelCls, role_enum = _role_to_model(req.role)

    employee = ModelCls(
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        birth_date=req.birth_date,
        email=req.email.strip(),
        phone_number=req.phone_number.strip(),
        gender=req.gender,
        password=req.password,  # plaintext
        role=role_enum,
        address_id=adr.id_adr,
        hire_date=date.today(),
        contract_type=req.contract_type.strip(),
        salary=req.salary,
    )

    try:
        db.add(employee)
        db.commit()
        db.refresh(employee)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create staff (duplicate email or integrity error).")

    return StaffResponse(
        user_id=employee.id_u,
        role=employee.role.value if hasattr(employee.role, "value") else str(employee.role),
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        phone_number=employee.phone_number,
        contract_type=getattr(employee, "contract_type", None),
        hire_date=getattr(employee, "hire_date", None),
        salary=getattr(employee, "salary", None),
        address_id=employee.address_id,
    )


@router.get("/staff", response_model=list[StaffResponse])
def list_staff(
    manager_id: int = Query(..., ge=1),
    role: StaffRole | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _ensure_manager(db, manager_id)

    q = (
        db.query(models.Employee)
        .filter(
            models.Employee.role.in_(
                [
                    models.UserRole.RECEPTIONIST,
                    models.UserRole.INSTRUCTOR,
                    models.UserRole.PERSONAL_TRAINER,
                ]
            )
        )
        .order_by(models.Employee.id_u.desc())
    )

    if role is not None:
        q = q.filter(models.Employee.role == models.UserRole[role.value])

    rows = q.all()

    return [
        StaffResponse(
            user_id=r.id_u,
            role=r.role.value if hasattr(r.role, "value") else str(r.role),
            first_name=r.first_name,
            last_name=r.last_name,
            email=r.email,
            phone_number=r.phone_number,
            contract_type=getattr(r, "contract_type", None),
            hire_date=getattr(r, "hire_date", None),
            salary=getattr(r, "salary", None),
            address_id=r.address_id,
        )
        for r in rows
    ]
