import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..ai.foundry import get_foundry_settings, validate_foundry_settings
from ..database.db import get_db
from ..nlp.query_engine import NLQueryEngine
from .schemas import NLQueryRequest, NLQueryResponse

router = APIRouter(prefix="/api/nl-query", tags=["nlp"])
logger = logging.getLogger(__name__)


@router.post("", response_model=NLQueryResponse)
def nl_query(req: NLQueryRequest, db: Session = Depends(get_db)):
    is_valid, error_message = validate_foundry_settings()
    if not is_valid:
        raise HTTPException(status_code=503, detail=error_message)

    settings = get_foundry_settings()
    engine = NLQueryEngine(
        model=settings["model"],
        max_tokens=settings["max_tokens"],
        session=db,
    )

    try:
        answer = engine.ask(req.question)
    except Exception as e:
        logger.exception("NL query failed")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    return NLQueryResponse(answer=answer)
