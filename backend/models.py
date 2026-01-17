from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum, Boolean, Numeric, Text
from sqlalchemy.sql import func
from .database import Base
import enum

# --------- ENUMS (Global definitions) ---------
class UserRole(str, enum.Enum):
    CLIENT = "CLIENT"
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    RECEPTIONIST = "RECEPTIONIST"
    PERSONAL_TRAINER = "PERSONAL_TRAINER"
    INSTRUCTOR = "INSTRUCTOR"

class Gender(str, enum.Enum):
    MALE = "M"
    FEMALE = "F"

class ClassesType(str, enum.Enum):
    INDIVIDUAL = "INDIVIDUAL"
    GROUP = "GROUP"

class MembershipType(str, enum.Enum):
    ONE_TIME_PASS = "ONE_TIME_PASS"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUAL = "ANNUAL"

# --------- CLUBS ---------
class Club(Base):
    __tablename__ = "clubs"
    
    id_cl = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False) # Added name for the club
    tax_rate = Column(Numeric(5, 2), nullable=False, default=23.00) # Numeric is safer for taxes
    manager_id = Column(Integer, ForeignKey("managers.id_u"), nullable=False)

# --------- ADDRESSES ---------
class Addresses(Base):
    __tablename__ = "addresses"

    id_adr = Column(Integer, primary_key=True)
    city = Column(String(100), nullable=False)
    postal_code = Column(String(10), nullable=False) 
    street_name = Column(String(100), nullable=False)
    street_number = Column(String(20), nullable=False) # Changed to String (e.g., "10A")
    apartment_number = Column(String(20)) # Changed to String (e.g., "4B")
    club_id = Column(Integer, ForeignKey("clubs.id_cl"), nullable=True) # Nullable because address might belong to User

# --------- USERS ---------
class User(Base):
    __tablename__ = "users"

    id_u = Column(Integer, primary_key=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False, index=True)
    birth_date = Column(Date, nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), nullable=False)
    gender = Column(Enum(Gender), nullable=False) # Using Enum prevents bad data
    password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    address_id = Column(Integer, ForeignKey("addresses.id_adr"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) # Audit field: automatically tracks creation time

    # Inheritance configuration
    __mapper_args__ = { 
        "polymorphic_on": role,
    }

class Client(User):
    __tablename__ = "clients"
    id_u = Column(Integer, ForeignKey("users.id_u"), primary_key=True)
    
    __mapper_args__ = { "polymorphic_identity": UserRole.CLIENT }

class Employee(User):
    __tablename__ = "employees"
    id_u = Column(Integer, ForeignKey("users.id_u"), primary_key=True)
    contract_type = Column(String(50))
    hire_date = Column(Date, nullable=False)
    salary = Column(Numeric(10, 2)) # Numeric for precise money values

    __mapper_args__ = { "polymorphic_identity": UserRole.EMPLOYEE }

# --- Employee Subclasses ---
class Manager(Employee):
    __tablename__ = "managers"
    id_u = Column(Integer, ForeignKey("employees.id_u"), primary_key=True)
    __mapper_args__ = { "polymorphic_identity": UserRole.MANAGER }

class Receptionist(Employee):
    __tablename__ = "receptionists"
    id_u = Column(Integer, ForeignKey("employees.id_u"), primary_key=True)
    __mapper_args__ = { "polymorphic_identity": UserRole.RECEPTIONIST }

class PersonalTrainer(Employee):
    __tablename__ = "personal_trainers"
    id_u = Column(Integer, ForeignKey("employees.id_u"), primary_key=True)
    bio = Column(Text) # Text allows  descriptions
    __mapper_args__ = { "polymorphic_identity": UserRole.PERSONAL_TRAINER }

class Instructor(Employee):
    __tablename__ = "instructors"
    id_u = Column(Integer, ForeignKey("employees.id_u"), primary_key=True)
    bio = Column(Text)
    __mapper_args__ = { "polymorphic_identity": UserRole.INSTRUCTOR }

# --------- CLASSES ---------
class Classes(Base):
    __tablename__ = "classes"

    id_c = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # Moved Name and Description here to avoid repetition
    description = Column(Text, nullable=True)# Moved Name and Description here to avoid repetition
    start_time = Column(DateTime, nullable=False)  # Changed to DateTime to include time (e.g. 18:00)
    end_time = Column(DateTime, nullable=False)
    room = Column(String(50), nullable=False)
    classes_type = Column(Enum(ClassesType), nullable=False)

    __mapper_args__ = {
        "polymorphic_on": classes_type,
    }

class IndividualClasses(Classes):
    __tablename__ = "individual_classes"

    id_c = Column(Integer, ForeignKey("classes.id_c"), primary_key=True)
    additional_info = Column(String(255))
    client_id = Column(Integer, ForeignKey("clients.id_u"), nullable=True) # Nullable until booked
    per_trainer_id = Column(Integer, ForeignKey("personal_trainers.id_u"), nullable=False)

    __mapper_args__ = { "polymorphic_identity": ClassesType.INDIVIDUAL }

class GroupClasses(Classes):
    __tablename__ = "group_classes"

    id_c = Column(Integer, ForeignKey("classes.id_c"), primary_key=True)
    max_capacity = Column(Integer, default=20)
    instructor_id = Column(Integer, ForeignKey("instructors.id_u"), nullable=False)
    # Removed manager/receptionist IDs to reduce redundancy
    __mapper_args__ = { "polymorphic_identity": ClassesType.GROUP }

class BookGroupClasses(Base):
    __tablename__ = "book_group_classes"

    # Added a primary key for the booking itself
    id_booking = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id_u"), nullable=False)
    group_classes_id = Column(Integer, ForeignKey("group_classes.id_c"), nullable=False)
    booking_time = Column(DateTime(timezone=True), server_default=func.now())

# --------- MEMBERSHIPS ---------
class Membership(Base):
    __tablename__ = "memberships"

    id_m = Column(Integer, primary_key=True)
    type = Column(Enum(MembershipType), nullable=False)
    with_sauna = Column(Boolean, nullable=False, default=False)
    price = Column(Numeric(10, 2), nullable=False) # Changed to Numeric
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True) 
    is_active = Column(Boolean, default=True) # Logic flag
    
    client_id = Column(Integer, ForeignKey("clients.id_u"), nullable=False)
    receptionist_id = Column(Integer, ForeignKey("receptionists.id_u"), nullable=True) 

# --------- MESSAGES ---------
class Message(Base):
    __tablename__ = "messages"

    id_ms = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id_u"), nullable=False)    
    recipient_id = Column(Integer, ForeignKey("users.id_u"), nullable=False) 
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())     # Timestamp
    is_read = Column(Boolean, default=False)