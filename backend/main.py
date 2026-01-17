from fastapi import FastAPI
from .database import engine, Base # Import connection tools
from . import models
from . import schedule

# Check models and create tables in the DB
# If tables already exist don't overwrite them, only ccreate new ones
models.Base.metadata.create_all(bind=engine)

# Instance of FastAPI class
app=FastAPI()
app.include_router(schedule.router)
# Tells which URL should trigger this function
# The one below means: when someone visits the home page...
@app.get("/")
def check_status():
    return {"status": "Database created!"} # Returns a JSON response to verify connection with DB and server