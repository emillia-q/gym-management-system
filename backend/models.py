from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum
from .database import Base
import enum


# Definition of possible roles in the system
# str -> we use this so we don't get raw values but String type
class UserRole(str,enum.Enum):
    CLIENT="CLIENT"
    MANAGER="MANAGER"
    RECEPTIONIST="RECEPTIONIST"
    PERSONAL_TRAINER="PERSONAL TRAINER"
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

    # Configures table inheritance -> we use role record to determine which subclass we should be created
    __mapper_args__={ #
        "polymorphic_on": role,
    }
    #address=Column(Integer,ForeignKey("addresses.id_adr"),nullable=False)

# TODO: Create subclassed for base class User