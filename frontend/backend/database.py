import os # Standard library to interact with the operating system
from dotenv import load_dotenv # Function that load .env file content
from sqlalchemy import create_engine # SQLAlchemy is so called ORM
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# When .env is in the main catalofg
load_dotenv(dotenv_path=".env") 

# Load link to the database from .env
SQLALCHEMY_DATABASE_URL=os.getenv("DATABASE_URL")
#chek is value not null
if SQLALCHEMY_DATABASE_URL is None:
    raise ValueError("DATABASE_URL is not set. Please check your .env file!")
# Create the engine
engine=create_engine(SQLALCHEMY_DATABASE_URL) # This knows how to physically connect with Docker
SessionLocal=sessionmaker(autocommit=False,autoflush=False,bind=engine) # 'Movement in database'- each one is a distinct session
# autocommit=false -> we need to confirm changes (maybe to change later)

# Base class for all database models
# Every class will inherit from this one -> so teh SQLAlchemy knows that those classes are tables in database
Base=declarative_base()

# Dependency function to create/close database sessions for each API request
def get_db():
    db=SessionLocal() # Creates new session for each query
    try:
        yield db
    finally:
        db.close() # And automatically closes it