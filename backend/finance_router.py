import hashlib
from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models
from .finance_models import (
    MembershipPayment,
    PaymentMethod,
    PaymentStatus,
    BookGroupClassesMeta,
    ReservationStatus,
)
from .finance_schemas import (
    MembershipCatalogItem,
    ClientPurchaseRequest,
    ReceptionSellRequest,
    MembershipResponse,
    ReceptionReserveRequest,
)

router = APIRouter(tags=["Finance & Reception"])

# --- Cennik i stałe ---
BASE_PRICES = {
    models.MembershipType.ONE_TIME_PASS: 30,
    models.MembershipType.MONTHLY: 150,
    models.MembershipType.QUARTERLY: 400,
    models.MembershipType.ANNUAL: 1200,
}
SAUNA_SURCHARGE = 50

# Limit miejsc ustawiony na sztywno, wymagany do weryfikacji przy rezerwacji
MAX_CLASS_CAPACITY = 20


# --- Funkcje pomocnicze ---
def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()


def _add_months(d: date, months: int) -> date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    day = min(d.day, monthrange(y, m)[1])
    return date(y, m, day)


def _compute_end_date(mtype: models.MembershipType, start: date) -> date:
    if mtype == models.MembershipType.ONE_TIME_PASS:
        return start
    if mtype == models.MembershipType.MONTHLY:
        return _add_months(start, 1)
    if mtype == models.MembershipType.QUARTERLY:
        return _add_months(start, 3)
    if mtype == models.MembershipType.ANNUAL:
        return date(start.year + 1, start.month, min(start.day, monthrange(start.year + 1, start.month)[1]))
    raise ValueError("Unknown membership type")


def _compute_price(mtype: models.MembershipType, with_sauna: bool, override: int | None) -> int:
    if override is not None:
        return override

    if isinstance(mtype, str):
        mtype = models.MembershipType(mtype)

    base = BASE_PRICES[mtype]
    return base + (SAUNA_SURCHARGE if with_sauna else 0)


def _require_role(db: Session, user_id: int, role: models.UserRole):
    user = db.query(models.User).filter(models.User.id_u == user_id).first()
    if not user or user.role != role:
        raise HTTPException(status_code=404, detail=f"User {user_id} with role {role} not found")
    return user


# --- 1. ZAKUP KARNETÓW (Proces wyboru rodzaju i wariantu) ---
@router.get("/memberships/catalog", response_model=list[MembershipCatalogItem])
def catalog():
    """
    Zwraca katalog karnetów.
    Rozróżnia ofertę dostępną online (Client) i tylko stacjonarnie (Reception - np. OneTimePass).
    """
    items: list[MembershipCatalogItem] = []
    for t in models.MembershipType:
        for with_sauna in (False, True):
            if t == models.MembershipType.ONE_TIME_PASS:
                # Karnet jednorazowy tylko na recepcji
                items.append(MembershipCatalogItem(
                    type=t,
                    variant="GYM_SAUNA" if with_sauna else "GYM",
                    purchase_channel="RECEPTION_ONLY",
                    allowed_payment=[PaymentMethod.CASH, PaymentMethod.ONLINE],
                ))
            else:
                # Pozostałe dostępne dla klienta
                items.append(MembershipCatalogItem(
                    type=t,
                    variant="GYM_SAUNA" if with_sauna else "GYM",
                    purchase_channel="CLIENT",
                    allowed_payment=[PaymentMethod.ONLINE, PaymentMethod.CASH],
                ))
    return items


# --- 2. ZAKUP PRZEZ UŻYTKOWNIKA (Inna logika: blokada jednorazowych, status płatności) ---
@router.post("/clients/{client_id}/memberships/purchase", response_model=MembershipResponse)
def client_purchase(client_id: int, req: ClientPurchaseRequest, db: Session = Depends(get_db)):
    _require_role(db, client_id, models.UserRole.CLIENT)

    # Klient nie może kupić jednorazowego online (wymóg biznesowy)
    if req.type == models.MembershipType.ONE_TIME_PASS:
        raise HTTPException(status_code=400, detail="ONE_TIME_PASS can be purchased only at reception")

    end_date = _compute_end_date(req.type, req.start_date)
    price = _compute_price(req.type, req.with_sauna, req.price_override)

    # Jeśli płatność online -> AKTYWOWANY, inna -> DO OPŁACENIA
    pay_status = PaymentStatus.ACTIVATED if req.payment_method == PaymentMethod.ONLINE else PaymentStatus.TO_PAY

    m = models.Membership(
        type=req.type,
        with_sauna=req.with_sauna,
        price=price,
        start_date=req.start_date,
        end_date=end_date,
        client_id=client_id,
        receptionist_id=None,
    )
    db.add(m)
    db.flush()

    mp = MembershipPayment(
        membership_id=m.id_m,
        status=pay_status,
        payment_method=req.payment_method,
    )
    db.add(mp)
    db.commit()

    return MembershipResponse(
        membership_id=m.id_m,
        client_id=client_id,
        type=m.type,
        with_sauna=m.with_sauna,
        price=m.price,
        start_date=m.start_date,
        end_date=m.end_date,
        payment_status=mp.status.value,
        payment_method=mp.payment_method,
    )


# --- 3. ZAKUP PRZEZ RECEPCJĘ (Inna logika: obsługa nowych klientów, natychmiastowa aktywacja) ---
@router.post("/reception/memberships/sell", response_model=MembershipResponse)
def reception_sell(req: ReceptionSellRequest, db: Session = Depends(get_db)):
    _require_role(db, req.receptionist_id, models.UserRole.RECEPTIONIST)

    client_id = req.client_id

    # Logika "Szybkiej rejestracji" - jeśli klient nie istnieje, recepcja go tworzy przy zakupie
    if client_id is None:
        needed = [
            req.new_client_email, req.new_client_password, req.new_client_first_name,
            req.new_client_last_name, req.new_client_phone_number, req.new_client_gender,
            req.new_client_birth_date
        ]
        if any(v is None for v in needed):
            raise HTTPException(status_code=400, detail="Provide client_id or full new_client_* fields")

        existing = db.query(models.User).filter(models.User.email == req.new_client_email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already exists")

        client = models.Client(
            first_name=req.new_client_first_name,
            last_name=req.new_client_last_name,
            birth_date=req.new_client_birth_date,
            email=req.new_client_email,
            phone_number=req.new_client_phone_number,
            gender=req.new_client_gender,
            password=_hash_password(req.new_client_password),
            role=models.UserRole.CLIENT,
            address_id=req.new_client_address_id,
        )
        db.add(client)
        db.flush()
        client_id = client.id_u
    else:
        _require_role(db, client_id, models.UserRole.CLIENT)

    end_date = _compute_end_date(req.type, req.start_date)
    price = _compute_price(req.type, req.with_sauna, req.price_override)

    # Sprzedaż na recepcji -> zawsze od razu opłacone/aktywowane
    pay_status = PaymentStatus.ACTIVATED

    m = models.Membership(
        type=req.type,
        with_sauna=req.with_sauna,
        price=price,
        start_date=req.start_date,
        end_date=end_date,
        client_id=client_id,
        receptionist_id=req.receptionist_id,
    )
    db.add(m)
    db.flush()

    mp = MembershipPayment(
        membership_id=m.id_m,
        status=pay_status,
        payment_method=req.payment_method,
    )
    db.add(mp)
    db.commit()

    return MembershipResponse(
        membership_id=m.id_m,
        client_id=client_id,
        type=m.type,
        with_sauna=m.with_sauna,
        price=m.price,
        start_date=m.start_date,
        end_date=m.end_date,
        payment_status=mp.status.value,
        payment_method=mp.payment_method,
    )


# --- 4. REZERWACJA ZAJĘĆ PRZEZ RECEPCJONISTĘ ---
@router.post("/reception/group-classes/{group_class_id}/reserve")
def reception_reserve(group_class_id: int, req: ReceptionReserveRequest, db: Session = Depends(get_db)):
    """
    Rezerwacja w imieniu klienta przez recepcjonistę.
    Zawiera logikę sprawdzania wolnych miejsc oraz weryfikację ważności karnetu.
    """
    _require_role(db, req.receptionist_id, models.UserRole.RECEPTIONIST)
    _require_role(db, req.client_id, models.UserRole.CLIENT)

    # 1. Pobieramy dane o zajęciach
    gc = db.query(models.GroupClasses).filter(models.GroupClasses.id_c == group_class_id).first()
    if not gc:
        raise HTTPException(status_code=404, detail="Group class not found")

    # 2. Weryfikacja wolnych miejsc (zgodnie z wymogiem obsługi)
    current_bookings_count = db.query(models.BookGroupClasses).filter(
        models.BookGroupClasses.group_classes_id == group_class_id
    ).count()

    if current_bookings_count >= MAX_CLASS_CAPACITY:
        raise HTTPException(status_code=409, detail="Class is full (limit reached)")

    # 3. Sprawdzenie czy klient nie jest już zapisany
    exists = db.query(models.BookGroupClasses).filter(
        models.BookGroupClasses.client_id == req.client_id,
        models.BookGroupClasses.group_classes_id == group_class_id,
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Already reserved")

    # 4. Weryfikacja karnetu (przypisanie karnetu do zajęć)
    membership_id = req.membership_id
    res_status = ReservationStatus.TO_PAY

    if membership_id is not None:
        m = db.query(models.Membership).filter(models.Membership.id_m == membership_id).first()

        # Czy karnet należy do klienta?
        if not m or m.client_id != req.client_id:
            raise HTTPException(status_code=400, detail="Invalid membership_id for this client")

        # Czy karnet jest ważny w dacie zajęć?
        if not (m.start_date <= gc.start_date <= m.end_date):
            raise HTTPException(
                status_code=400,
                detail=f"Membership is not valid on the class date ({gc.start_date})"
            )

        mp = db.query(MembershipPayment).filter(MembershipPayment.membership_id == membership_id).first()
        if mp and mp.status == PaymentStatus.ACTIVATED:
            res_status = ReservationStatus.PAID
        else:
            res_status = ReservationStatus.TO_PAY

    # Zapis w bazie
    booking = models.BookGroupClasses(client_id=req.client_id, group_classes_id=group_class_id)
    db.add(booking)

    meta = BookGroupClassesMeta(
        client_id=req.client_id,
        group_classes_id=group_class_id,
        membership_id=membership_id,
        status=res_status,
        booked_by_receptionist_id=req.receptionist_id,
    )
    db.add(meta)

    db.commit()
    return {"ok": True, "status": res_status.value}

# --- 2b. LISTA KARNETÓW KLIENTA ---
@router.get("/clients/{client_id}/memberships", response_model=list[MembershipResponse])
def list_client_memberships(client_id: int, db: Session = Depends(get_db)):
    """Returns all memberships purchased by a client (history), newest first."""
    _require_role(db, client_id, models.UserRole.CLIENT)

    memberships = (
        db.query(models.Membership)
        .filter(models.Membership.client_id == client_id)
        .order_by(models.Membership.start_date.desc(), models.Membership.id_m.desc())
        .all()
    )

    if not memberships:
        return []

    ids = [m.id_m for m in memberships]
    payments = (
        db.query(MembershipPayment)
        .filter(MembershipPayment.membership_id.in_(ids))
        .all()
    )
    pay_by_id = {p.membership_id: p for p in payments}

    out: list[MembershipResponse] = []
    for m in memberships:
        p = pay_by_id.get(m.id_m)
        out.append(
            MembershipResponse(
                membership_id=m.id_m,
                client_id=client_id,
                type=m.type,
                with_sauna=m.with_sauna,
                price=m.price,
                start_date=m.start_date,
                end_date=m.end_date,
                payment_status=(p.status.value if p else "UNKNOWN"),
                payment_method=(p.payment_method if p else PaymentMethod.CASH),
            )
        )

    return out
