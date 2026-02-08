from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum, Boolean, Double
from .database import Base
from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, Enum as SAEnum
import enum

# ---------CLUBS---------
class Club(Base):
    __tablename__="clubs"
    
    id_cl=Column(Integer,primary_key=True)
    tax=Column(Double,nullable=False)
    manager_id=Column(Integer,ForeignKey("managers.id_u"),nullable=False)
    
# ---------ADDRESSES---------
class Addresses(Base):
    __tablename__="addresses"

    id_adr=Column(Integer,primary_key=True)
    city=Column(String(100),nullable=False)
    postal_code=Column(String(10),nullable=False)
    street_name=Column(String(100),nullable=False)
    street_number=Column(Integer,nullable=False)
    apartment_number=Column(Integer)

# ---------USERS---------
# Definition of possible roles in the system
# str -> we use this so we don't get raw values but String type
class UserRole(str,enum.Enum):
    CLIENT="CLIENT"
    EMPLOYEE="EMPLOYEE"
    MANAGER="MANAGER"
    RECEPTIONIST="RECEPTIONIST"
    PERSONAL_TRAINER="PERSONAL_TRAINER"
    INSTRUCTOR="INSTRUCTOR"

class User(Base):
    __tablename__="users"

    id_u=Column(Integer,primary_key=True)
    first_name=Column(String(20),nullable=False)
    last_name=Column(String(50), nullable=False,index=True)
    birth_date=Column(Date,nullable=False)
    email=Column(String(100),unique=True,nullable=False,index=True)
    phone_number=Column(String(20),nullable=False)
    gender=Column(String(1),nullable=False)
    password=Column(String(255),nullable=False)
    role=Column(Enum(UserRole),nullable=False)
    address_id=Column(Integer,ForeignKey("addresses.id_adr"),nullable=False)

    # Configures table inheritance -> we use role record to determine which subclass we should be created
    __mapper_args__={ 
        "polymorphic_on": role,
    }

class Client(User):
    __tablename__="clients"

    id_u=Column(Integer,ForeignKey("users.id_u"),primary_key=True)

    __mapper_args__={
        "polymorphic_identity":UserRole.CLIENT
    }

class Employee(User):
    __tablename__="employees"

    id_u=Column(Integer,ForeignKey("users.id_u"),primary_key=True)
    contract_type=Column(String)
    hire_date=Column(Date,nullable=False)
    salary=Column(Integer) 

    __mapper_args__ = {
        "polymorphic_identity": UserRole.EMPLOYEE 
    }

class Manager(Employee):
    __tablename__="managers"

    id_u=Column(Integer,ForeignKey("employees.id_u"),primary_key=True)

    __mapper_args__={
        "polymorphic_identity":UserRole.MANAGER
    }

class Receptionist(Employee):
    __tablename__="receptionists"

    id_u=Column(Integer,ForeignKey("employees.id_u"),primary_key=True)

    __mapper_args__={
        "polymorphic_identity":UserRole.RECEPTIONIST
    }

class PersonalTrainer(Employee):
    __tablename__="personal_trainers"

    id_u=Column(Integer,ForeignKey("employees.id_u"),primary_key=True)

    __mapper_args__={
        "polymorphic_identity":UserRole.PERSONAL_TRAINER
    }

class Instructor(Employee):
    __tablename__="instructors"

    id_u=Column(Integer,ForeignKey("employees.id_u"),primary_key=True)

    __mapper_args__={
        "polymorphic_identity":UserRole.INSTRUCTOR
    }

# ---------CLASSES---------
class ClassesType(str,enum.Enum):
    INDIVIDUAL="INDIVIDUAL"
    GROUP="GROUP"

class Classes(Base):
    __tablename__="classes"

    id_c=Column(Integer,primary_key=True)
    start_date=Column(Date,nullable=False)
    end_date=Column(Date,nullable=False)

    start_time=Column(Time, nullable=False)   # <-- DODAJ
    end_time=Column(Time, nullable=False)     # <-- DODAJ

    room=Column(String(20),nullable=False)
    classes_type=Column(SAEnum(ClassesType),nullable=False)

    __mapper_args__={
        "polymorphic_on":classes_type,
        "polymorphic_identity":ClassesType.INDIVIDUAL
    }

class IndividualClasses(Classes):
    __tablename__="individual_classes"

    id_c=Column(Integer,ForeignKey("classes.id_c"),primary_key=True)
    additional_info=Column(String(250))
    client_id=Column(Integer,ForeignKey("clients.id_u"),nullable=False)
    per_trainer_id=Column(Integer,ForeignKey("personal_trainers.id_u"),nullable=False)

    __mapper_args__={
        "polymorphic_identity":ClassesType.INDIVIDUAL
    }

class GroupClasses(Classes):
    __tablename__="group_classes"

    id_c=Column(Integer,ForeignKey("classes.id_c"),primary_key=True)
    name=Column(String(30),nullable=False)
    instructor_id=Column(Integer,ForeignKey("instructors.id_u"),nullable=False)
    manager_id=Column(Integer,ForeignKey("managers.id_u"))
    receptionist_id=Column(Integer,ForeignKey("receptionists.id_u"))

    __mapper_args__={
        "polymorphic_identity":ClassesType.GROUP
    }

class BookGroupClasses(Base):
    __tablename__="book_group_classes"

    client_id=Column(Integer,ForeignKey("clients.id_u"),nullable=False,primary_key=True)
    group_classes_id=Column(Integer,ForeignKey("group_classes.id_c"),nullable=False,primary_key=True)

# ---------MEMBERSHIPS---------
class MembershipType(str,enum.Enum):
    ONE_TIME_PASS="ONE_TIME_PASS"
    MONTHLY="MONTHLY"
    QUARTERLY="QUARTERLY"
    ANNUAL="ANNUAL"

class Membership(Base):
    __tablename__="memberships"

    id_m=Column(Integer,primary_key=True)
    type=Column(Enum(MembershipType),nullable=False)
    with_sauna=Column(Boolean,nullable=False)
    price=Column(Integer,nullable=False) # Better option is distinct table with prices for each plan, but for now let's leave it like this
    start_date = Column(Date, nullable=False) # One day for one time pass
    end_date = Column(Date) # So this is not obligatory for it
    client_id=Column(Integer,ForeignKey("clients.id_u"),nullable=False)
    receptionist_id=Column(Integer,ForeignKey("receptionists.id_u"))

# ---------MESSAGES---------
class Message(Base):
    __tablename__="messages"

    id_ms=Column(Integer,primary_key=True)
    content=Column(String(255),nullable=False)
    pers_trainer_id=Column(Integer,ForeignKey("personal_trainers.id_u"),nullable=False)

class ReceiveMsg(Base):
    __tablename__="receive_msg"

    client_id=Column(Integer,ForeignKey("clients.id_u"),nullable=False,primary_key=True)
    msg_id=Column(Integer,ForeignKey("messages.id_ms"),nullable=False,primary_key=True)
    pers_trainer_id=Column(Integer,ForeignKey("personal_trainers.id_u"),nullable=False,primary_key=True)



