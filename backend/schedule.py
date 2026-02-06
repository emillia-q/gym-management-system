from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, database
from pydantic import BaseModel

router = APIRouter(
    prefix="/schedule",
    tags=["Schedule & Booking (Osoba 1)"]
)

# minimalny fallback pojemności, jeśli DB/model nie ma max_capacity
DEFAULT_MAX_CAPACITY = 20


class BookingRequest(BaseModel):
    client_id: int
    group_class_id: int


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_start_dt(obj):
    """Obsługa rozjazdu: start_time vs start_date."""
    return getattr(obj, "start_time", None) or getattr(obj, "start_date", None)


def _get_max_capacity(group_class):
    """Obsługa braku kolumny max_capacity w modelu/DB."""
    return getattr(group_class, "max_capacity", None) or DEFAULT_MAX_CAPACITY


@router.get("/classes")
def get_available_classes(db: Session = Depends(get_db)):
    """
    Returns a list of all group classes with capacity information.
    (Zawsze zwraca max_capacity, nawet jeśli nie ma go w DB -> fallback 20)
    """
    classes = db.query(models.GroupClasses).all()

    # Zwracamy prostą, stabilną strukturę pod frontend
    result = []
    for c in classes:
        result.append({
            "id_c": getattr(c, "id_c", None),
            "name": getattr(c, "name", None),
            "start_time": _get_start_dt(c),  # trzymamy nazwę start_time dla frontu
            "room": getattr(c, "room", None),
            "max_capacity": _get_max_capacity(c),
        })

    return result


@router.post("/book")
def book_class(booking: BookingRequest, db: Session = Depends(get_db)):
    """
    Booking logic:
    1. Check if the class exists.
    2. Count how many people are ALREADY booked.
    3. Compare with max_capacity (fallback 20).
    4. If there is space -> book. If not -> error.
    """

    group_class = db.query(models.GroupClasses).filter(
        models.GroupClasses.id_c == booking.group_class_id
    ).first()

    if not group_class:
        raise HTTPException(status_code=404, detail="Class not found")

    current_bookings_count = db.query(func.count(models.BookGroupClasses.id_booking)) \
        .filter(models.BookGroupClasses.group_classes_id == booking.group_class_id) \
        .scalar()

    max_capacity = _get_max_capacity(group_class)

    if current_bookings_count >= max_capacity:
        raise HTTPException(status_code=400, detail="Sorry, no places left (Full capacity)")

    existing_booking = db.query(models.BookGroupClasses).filter(
        models.BookGroupClasses.group_classes_id == booking.group_class_id,
        models.BookGroupClasses.client_id == booking.client_id
    ).first()

    if existing_booking:
        raise HTTPException(status_code=400, detail="You are already booked for this class")

    new_booking = models.BookGroupClasses(
        client_id=booking.client_id,
        group_classes_id=booking.group_class_id
    )

    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    return {
        "status": "success",
        "message": "You have been successfully booked!",
        "booking_id": new_booking.id_booking
    }


@router.get("/my-bookings/{client_id}")
def get_my_bookings(client_id: int, db: Session = Depends(get_db)):
    """
    Shows all bookings for a specific client.
    """
    my_bookings = db.query(models.BookGroupClasses).filter(
        models.BookGroupClasses.client_id == client_id
    ).all()

    if not my_bookings:
        return []

    result_list = []
    for booking in my_bookings:
        class_info = db.query(models.Classes).filter(
            models.Classes.id_c == booking.group_classes_id
        ).first()

        if class_info:
            result_list.append({
                "booking_id": booking.id_booking,
                "class_name": getattr(class_info, "name", None),
                "start_time": _get_start_dt(class_info),  # fallback start_date
                "room": getattr(class_info, "room", None),
            })

    return result_list
