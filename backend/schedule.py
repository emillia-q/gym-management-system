from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, database
from pydantic import BaseModel

router = APIRouter(
    prefix="/schedule",
    tags=["Schedule & Booking (Osoba 1)"]
)

# Pydantic model for the data we send during booking
# This creates a nice input form in Swagger where the IDs need to be entered
class BookingRequest(BaseModel):
    client_id: int
    group_class_id: int

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Endpointy dla grafiku: pobranie dostępnych zajęć. 
@router.get("/classes")
def get_available_classes(db: Session = Depends(get_db)):
    """
    Returns a list of all group classes with capacity information.
    """
    # We get data from the GroupClasses table.
    # Thanks to inheritance, Python automatically fetches the name and time from the Classes table.
    classes = db.query(models.GroupClasses).all()
    return classes

#Rezerwacja zajęć grupowych: logika sprawdzenia wolnych miejsc i przypisania danego
#użytkownika lub jego karnetu do zajęć odbywających się
@router.post("/book")
def book_class(booking: BookingRequest, db: Session = Depends(get_db)):
    """
    Booking logic:
    1. Check if the class exists.
    2. Count how many people are ALREADY booked.
    3. Compare with max_capacity.
    4. If there is space -> book. If not -> error.
    """
    
    # 1. Search for the class in the database
    group_class = db.query(models.GroupClasses).filter(models.GroupClasses.id_c == booking.group_class_id).first()
    
    if not group_class:
        raise HTTPException(status_code=404, detail="Class not found")

    # 2. Count the number of existing bookings for this class
    current_bookings_count = db.query(func.count(models.BookGroupClasses.id_booking)) \
                               .filter(models.BookGroupClasses.group_classes_id == booking.group_class_id) \
                               .scalar()

    # 3. Check availability
    if current_bookings_count >= group_class.max_capacity:
        raise HTTPException(status_code=400, detail="Sorry, no places left (Full capacity)")

    # 4. Check: is this client already booked? (To prevent double booking)
    existing_booking = db.query(models.BookGroupClasses).filter(
        models.BookGroupClasses.group_classes_id == booking.group_class_id,
        models.BookGroupClasses.client_id == booking.client_id
    ).first()
    
    if existing_booking:
         raise HTTPException(status_code=400, detail="You are already booked for this class")

    # 5. If all checks pass -> Create booking
    new_booking = models.BookGroupClasses(
        client_id=booking.client_id,
        group_classes_id=booking.group_class_id
    )
    
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    
    return {"status": "success", "message": "You have been successfully booked!", "booking_id": new_booking.id_booking}


# Zarządzanie rezerwacjami: widok „moje rezerwacje” albo coś w tym stylu. 

@router.get("/my-bookings/{client_id}")
def get_my_bookings(client_id: int, db: Session = Depends(get_db)):
    """
    Shows all future bookings for a specific client.
    """
    # 1. Search for bookings
    my_bookings = db.query(models.BookGroupClasses).filter(
        models.BookGroupClasses.client_id == client_id
    ).all()
    
    if not my_bookings:
        return [] # Return empty list if there are no bookings
    
    result_list = []
    for booking in my_bookings:
        # 2. Search for class information
        class_info = db.query(models.Classes).filter(models.Classes.id_c == booking.group_classes_id).first()
        
        #    EXISTENCE CHECK
        if class_info: 
            result_list.append({
                "booking_id": booking.id_booking,
                "class_name": class_info.name,          
                "start_time": class_info.start_time,
                "room": class_info.room
            })
        
    return result_list