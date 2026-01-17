from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .database import get_db
from .models import Classes, IndividualClasses, ClassesType, User, UserRole

router = APIRouter()

def is_personal_trainer(db: Session, trainer_id: int) -> bool:
    trainer = db.query(User).filter(
        User.id_u == trainer_id,
        User.role == UserRole.PERSONAL_TRAINER
    ).first()

    return trainer is not None

def is_room_free(db: Session, room: str, start_date, end_date) -> bool:
    overlapping = db.query(Classes).filter(
        Classes.room == room,
        and_(
            start_date < Classes.end_date,
            end_date > Classes.start_date
        )
    ).first()

    return overlapping is None

def individual_classes_limit_reached(db: Session, start_date, end_date) -> bool:
    overlapping_count = (
        db.query(IndividualClasses)
        .filter(
            and_(
                start_date < Classes.end_date,
                end_date > Classes.start_date
            )
        )
        .count()
    )

    return overlapping_count >= 10

@router.post(
    "/individual-classes",
    status_code=status.HTTP_201_CREATED
)
def create_individual_class(
    start_date,
    end_date,
    room: str,
    client_id: int,
    per_trainer_id: int,
    additional_info: str | None = None,
    db: Session = Depends(get_db)
):
    # Role check: must be PERSONAL_TRAINER
    if not is_personal_trainer(db, per_trainer_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a personal trainer"
        )

    # Max 10 individual classes at same time
    if individual_classes_limit_reached(db, start_date, end_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum number of individual classes reached for this time slot"
        )

    # Room availability check
    if not is_room_free(db, room, start_date, end_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room is not available in the selected time range"
        )

    # Create individual class
    individual_class = IndividualClasses(
        start_date=start_date,
        end_date=end_date,
        room=room,
        classes_type=ClassesType.INDIVIDUAL,
        additional_info=additional_info,
        client_id=client_id,
        per_trainer_id=per_trainer_id
    )

    db.add(individual_class)
    db.commit()
    db.refresh(individual_class)

    return {
        "message": "Individual class created successfully",
        "class_id": individual_class.id_c
    }

