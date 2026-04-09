import os
import yaml
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database.db import get_db
from ..nlp.query_engine import NLQueryEngine
from .schemas import NLQueryRequest, NLQueryResponse

router = APIRouter(prefix="/api/nl-query", tags=["nlp"])


def _load_anthropic_config() -> dict:
    config_path = os.path.join(os.path.dirname(__file__), "..", "..", "config.yaml")
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = yaml.safe_load(f) or {}
            return config.get("anthropic", {})
    return {}


@router.post("", response_model=NLQueryResponse)
def nl_query(req: NLQueryRequest, db: Session = Depends(get_db)):
    anthropic_config = _load_anthropic_config()
    api_key = anthropic_config.get("api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable or add it to config.yaml.",
        )

    model = anthropic_config.get("model") or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    engine = NLQueryEngine(api_key=api_key, model=model, session=db)

    try:
        answer = engine.ask(req.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    return NLQueryResponse(answer=answer)
