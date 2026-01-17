from fastapi import FastAPI

from .database import engine, Base # Import connection tools
from . import models
from . import finance_models  # важно: зарегистрировать новые таблицы в metadata
from .finance_router import router as finance_router

# Check models and create tables in the DB
# If tables already exist don't overwrite them, only create new ones
models.Base.metadata.create_all(bind=engine)

# Instance of FastAPI class
app=FastAPI()
app.include_router(finance_router)
# Tells which URL should trigger this function
# The one below means: when someone visits the home page...
@app.get("/")
def check_status():
    return {"status": "Database created!"} # Returns a JSON response to verify connection with DB and server