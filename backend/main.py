from fastapi import FastAPI, Depends, HTTPException
from .database import engine, Base, get_db # Import connection tools
from . import models,individual_classes
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from . import finance_models  # важно: зарегистрировать новые таблицы в metadata
from .finance_router import router as finance_router
from . import schedule

# Check models and create tables in the DB
# If tables already exist don't overwrite them, only create new ones
models.Base.metadata.create_all(bind=engine)

# Instance of FastAPI class
app=FastAPI()

app.include_router(
    individual_classes.router,
    prefix="/classes",
    tags=["Individual Classes"]
)

app.include_router(finance_router)

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