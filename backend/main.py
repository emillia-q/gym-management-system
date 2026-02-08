from fastapi import FastAPI, Depends, HTTPException
from .database import engine, Base, get_db # Import connection tools
from . import models,individual_classes
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from . import finance_models  # важно: зарегистрировать новые таблицы в metadata
from .finance_router import router as finance_router
from . import schedule
from typing import Optional
from sqlalchemy import func
from datetime import date, time
from .manager_staff import router as manager_staff_router

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

def ensure_db_schema():
    """
    Quick-and-dirty migrations (idempotent).
    Keeps dev DB in sync without Alembic.
    """
    with engine.begin() as conn:
        # Add start_time/end_time to classes if missing
        conn.execute(text("""
            ALTER TABLE classes
            ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '18:00';
        """))
        conn.execute(text("""
            ALTER TABLE classes
            ADD COLUMN IF NOT EXISTS end_time time NOT NULL DEFAULT '19:00';
        """))

# Check models and create tables in the DB
# If tables already exist don't overwrite them, only create new ones
models.Base.metadata.create_all(bind=engine)
ensure_db_schema()
# Instance of FastAPI class
app=FastAPI()

app.include_router(
    individual_classes.router,
    prefix="/classes",
    tags=["Individual Classes"]
)

app.include_router(finance_router)

app.include_router(manager_staff_router)

app.include_router(schedule.router)
# Tells which URL should trigger this function
# The one below means: when someone visits the home page...
@app.get("/")
def check_status():
    return {"status": "Database created!"} # Returns a JSON response to verify connection with DB and server


# -------USER CREATION-------
class AddressCreate(BaseModel):
    city: str
    postal_code: str
    street_name: str
    street_number: int
    apartment_number: Optional[int] = None

@app.post("/test/create-address")
def create_test_address(address: AddressCreate, db: Session = Depends(get_db)):
    new_adr = models.Addresses(**address.model_dump())
    db.add(new_adr)
    db.commit()
    return {"message": "Address created.", "id": new_adr.id_adr}



class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    birth_date: date  # Pydantic will check format RRRR-MM-DD
    phone_number: str
    gender: str
    role: models.UserRole
    address_id: int

@app.post("/test/create-user")
def create_test_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if the user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    # Create object from the defined role
    if user.role == models.UserRole.PERSONAL_TRAINER:
        new_user = models.PersonalTrainer(**user.model_dump(), hire_date=date.today())
    elif user.role == models.UserRole.RECEPTIONIST:
        new_user = models.Receptionist(**user.model_dump(), hire_date=date.today())
    elif user.role == models.UserRole.MANAGER:
        new_user = models.Manager(**user.model_dump(), hire_date=date.today())
    elif user.role == models.UserRole.INSTRUCTOR:
        new_user = models.Instructor(**user.model_dump(), hire_date=date.today())
    elif user.role == models.UserRole.CLIENT:
        new_user = models.Client(**user.model_dump())
    else:
        # For undefined roles- should not happen
        new_user = models.User(**user.model_dump())

    db.add(new_user)
    db.commit()
    return {"message": f"User with role {user.role} created."}

# -------LOG IN-------

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    # Fin user by email
    user = db.query(models.User).filter(models.User.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    # Password check
    if user.password != request.password:
        raise HTTPException(status_code=401, detail="Invalid password.")
    
    return {
        "message": "Login successful",
        "user_id": user.id_u,
        "role": user.role,
        "first_name": user.first_name
    }

# -------GROUP CLASSES-------


class GroupClassesCreate(BaseModel):
    start_date: date
    end_date: date
    start_time: time
    end_time: time
    room: str
    name: str
    instructor_id: int
    manager_id: int  # Manager id that creates classes
    receptionist_id: int | None = None

@app.post("/classes/group")
def create_group_class(data: GroupClassesCreate, db: Session = Depends(get_db)):
    # Verification of manager id
    manager = db.query(models.Manager).filter(models.Manager.id_u == data.manager_id).first()
    if not manager:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Only a Manager can create group classes."
        )

    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    if data.end_time <= data.start_time and data.end_date == data.start_date:
        raise HTTPException(status_code=400, detail="end_time must be > start_time (same-day class)")

    instructor_conflict = (
        db.query(models.GroupClasses)
        .filter(
            models.GroupClasses.instructor_id == data.instructor_id,
            models.GroupClasses.start_date <= data.end_date,
            models.GroupClasses.end_date >= data.start_date,
            models.GroupClasses.start_time < data.end_time,
            models.GroupClasses.end_time > data.start_time,
        )
        .first()
    )

    if instructor_conflict:
        raise HTTPException(
            status_code=400,
            detail="Instructor is already assigned to another group class at this time."
        )

    # ---- OPTIONAL (but recommended): room double-booking prevention ----
    room_conflict = (
        db.query(models.Classes)
        .filter(
            models.Classes.room == data.room,
            models.Classes.start_date <= data.end_date,
            models.Classes.end_date >= data.start_date,
            models.Classes.start_time < data.end_time,
            models.Classes.end_time > data.start_time,
        )
        .first()
    )

    if room_conflict:
        raise HTTPException(
            status_code=400,
            detail="Room is occupied during this time."
        )

    new_group_class = models.GroupClasses(
        start_date=data.start_date,
        end_date=data.end_date,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room,
        name=data.name,
        instructor_id=data.instructor_id,
        manager_id=data.manager_id,
        receptionist_id=data.receptionist_id,
        classes_type=models.ClassesType.GROUP
    )

    try:
        db.add(new_group_class)
        db.commit()
        db.refresh(new_group_class)
        return {"message": "Group class created successfully.", "class_id": new_group_class.id_c}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    
class DeleteClientRequest(BaseModel):
    password: str


@app.delete("/clients/{client_id}")
def delete_client(client_id: int, payload: DeleteClientRequest, db: Session = Depends(get_db)):
    """
    Deletes a CLIENT account and related data to avoid FK constraint errors.
    Requires password confirmation (minimal safety).
    """

    user = db.query(models.User).filter(models.User.id_u == client_id).first()
    if not user or user.role != models.UserRole.CLIENT:
        raise HTTPException(status_code=404, detail="Client not found.")

    # minimal confirmation
    if user.password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid password.")

    address_id = user.address_id

    try:
        # ---- MEMBERSHIPS -> PAYMENTS ----
        membership_ids = [
            m[0] for m in db.query(models.Membership.id_m)
            .filter(models.Membership.client_id == client_id)
            .all()
        ]

        if membership_ids:
            db.query(finance_models.MembershipPayment) \
              .filter(finance_models.MembershipPayment.membership_id.in_(membership_ids)) \
              .delete(synchronize_session=False)

        db.query(models.Membership) \
          .filter(models.Membership.client_id == client_id) \
          .delete(synchronize_session=False)

        # ---- BOOKINGS (meta + base) ----
        db.query(finance_models.BookGroupClassesMeta) \
          .filter(finance_models.BookGroupClassesMeta.client_id == client_id) \
          .delete(synchronize_session=False)

        db.query(models.BookGroupClasses) \
          .filter(models.BookGroupClasses.client_id == client_id) \
          .delete(synchronize_session=False)

        # ---- MESSAGES ----
        db.query(models.ReceiveMsg) \
          .filter(models.ReceiveMsg.client_id == client_id) \
          .delete(synchronize_session=False)

        # ---- INDIVIDUAL CLASSES ----
        db.query(models.IndividualClasses) \
          .filter(models.IndividualClasses.client_id == client_id) \
          .delete(synchronize_session=False)

        # ---- CLIENT + USER (joined-table inheritance) ----
        db.query(models.Client) \
          .filter(models.Client.id_u == client_id) \
          .delete(synchronize_session=False)

        db.query(models.User) \
          .filter(models.User.id_u == client_id) \
          .delete(synchronize_session=False)

        # ---- OPTIONAL: delete address if unused by anyone else ----
        others_using_address = db.query(func.count(models.User.id_u)).filter(
            models.User.address_id == address_id,
            models.User.id_u != client_id
        ).scalar()

        if others_using_address == 0:
            db.query(models.Addresses) \
              .filter(models.Addresses.id_adr == address_id) \
              .delete(synchronize_session=False)

        db.commit()
        return {"status": "success", "message": "Client deleted."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
