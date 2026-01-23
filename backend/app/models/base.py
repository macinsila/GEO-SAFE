# Base class for all models
# SQLAlchemy's declarative base allows models to inherit from it
# and automatically register themselves with the ORM registry

from sqlalchemy.orm import declarative_base

Base = declarative_base()
