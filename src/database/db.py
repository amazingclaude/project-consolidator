import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from .models import Base

_engine = None
_SessionLocal = None


def get_engine(db_path: str = "data/projects.db"):
    global _engine
    if _engine is None:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{db_path}",
            echo=False,
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(_engine)
    return _engine


def get_session(db_path: str = "data/projects.db") -> Session:
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine(db_path)
        _SessionLocal = sessionmaker(bind=engine)
    return _SessionLocal()


def get_db():
    """FastAPI dependency: yields a session, auto-closes after request."""
    session = get_session()
    try:
        yield session
    finally:
        session.close()
