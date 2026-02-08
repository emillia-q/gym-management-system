from __future__ import annotations

from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import models
from .database import get_db

router = APIRouter()


class IndividualClassCreate(BaseModel):
    start_date: date
    end_date: date
    start_time: time
    end_time: time
    room: str = Field(min_length=1, max_length=120)
    client_id: int = Field(gt=0)
    per_trainer_id: int = Field(gt=0)
    additional_info: str | None = None


def is_room_free(
    db: Session,
    *,
    room: str,
    start_date: date,
    start_time: time,
    end_time: time,
) -> bool:
    """True if there is no other class in the same room that overlaps the time range."""
    overlap = (
        db.query(models.Classes)
        .filter(
            models.Classes.room == room,
            models.Classes.start_date == start_date,
            models.Classes.start_time < end_time,
            models.Classes.end_time > start_time,
        )
        .first()
    )
    return overlap is None


def is_trainer_limit_reached(
    db: Session,
    *,
    per_trainer_id: int,
    start_date: date,
    start_time: time,
    end_time: time,
    limit: int = 5,
) -> bool:
    """Limit overlapping individual classes for this trainer."""
    count = (
        db.query(models.IndividualClasses)
        .join(models.Classes, models.IndividualClasses.id_c == models.Classes.id_c)
        .filter(
            models.IndividualClasses.per_trainer_id == per_trainer_id,
            models.Classes.classes_type == models.ClassesType.INDIVIDUAL,
            models.Classes.start_date == start_date,
            models.Classes.start_time < end_time,
            models.Classes.end_time > start_time,
        )
        .count()
    )
    return count >= limit


@router.post("/individual-classes")
def create_individual_class(req: IndividualClassCreate, db: Session = Depends(get_db)):
    # Validation
    if req.end_date != req.start_date:
        raise HTTPException(
            status_code=400,
            detail="Individual class must start and end on the same day.",
        )
    if req.end_time <= req.start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time.")

    if not is_room_free(
        db,
        room=req.room,
        start_date=req.start_date,
        start_time=req.start_time,
        end_time=req.end_time,
    ):
        raise HTTPException(status_code=400, detail="Room is occupied during this time.")

    if is_trainer_limit_reached(
        db,
        per_trainer_id=req.per_trainer_id,
        start_date=req.start_date,
        start_time=req.start_time,
        end_time=req.end_time,
    ):
        raise HTTPException(
            status_code=400,
            detail="Trainer reached the limit of overlapping individual classes.",
        )

    # Create Classes row + IndividualClasses row
    new_class = models.Classes(
        start_date=req.start_date,
        end_date=req.end_date,
        start_time=req.start_time,
        end_time=req.end_time,
        room=req.room,
        name="Individual training",
        classes_type=models.ClassesType.INDIVIDUAL,
    )

    try:
        db.add(new_class)
        db.flush()  # get id

        ind = models.IndividualClasses(
            id_c=new_class.id_c,
            per_trainer_id=req.per_trainer_id,
            client_id=req.client_id,
            additional_info=req.additional_info,
        )
        db.add(ind)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    return {
        "status": "success",
        "message": "Individual class created",
        "class_id": new_class.id_c,
    }
