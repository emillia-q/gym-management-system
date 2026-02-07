from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from . import models, database

router = APIRouter(
    prefix="/schedule",
    tags=["Schedule & Booking (Osoba 1)"]
)

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


def _get_max_capacity(group_class) -> int:
    # jeśli kiedyś dodacie max_capacity do modelu/DB, to zacznie działać automatycznie
    return getattr(group_class, "max_capacity", None) or DEFAULT_MAX_CAPACITY


@router.get("/classes")
def get_available_classes(db: Session = Depends(get_db)):
    """
    Public timetable list.
    """
    classes = db.query(models.GroupClasses).all()

    result = []
    for c in classes:
        result.append({
            "id_c": c.id_c,
            "name": c.name,
            "room": c.room,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "max_capacity": _get_max_capacity(c),
        })

    return result


@router.post("/book")
def book_class(booking: BookingRequest, db: Session = Depends(get_db)):
    """
    Book a group class for a client.
    """
    group_class = db.query(models.GroupClasses).filter(
        models.GroupClasses.id_c == booking.group_class_id
    ).first()

    if not group_class:
        raise HTTPException(status_code=404, detail="Class not found")

    # count bookings: BookGroupClasses ma PK (client_id, group_classes_id) bez id_booking
    current_bookings_count = db.query(func.count(models.BookGroupClasses.client_id)) \
        .filter(models.BookGroupClasses.group_classes_id == booking.group_class_id) \
        .scalar() or 0

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

    return {
        "status": "success",
        "message": "You have been successfully booked!",
        # brak id_booking w tabeli, więc zwracamy ID zajęć jako stabilny identyfikator
        "booking_id": booking.group_class_id,
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
        class_info = db.query(models.GroupClasses).filter(
            models.GroupClasses.id_c == booking.group_classes_id
        ).first()

        if class_info:
            result_list.append({
                "booking_id": booking.group_classes_id,   # stabilny "id" dla frontu
                "group_class_id": booking.group_classes_id,
                "class_name": class_info.name,
                "room": class_info.room,
                "start_date": class_info.start_date,
                "end_date": class_info.end_date,
                "start_time": class_info.start_time,
                "end_time": class_info.end_time,
            })

    return result_list
