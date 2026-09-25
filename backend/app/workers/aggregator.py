from app.models.database import SessionLocal
from app.core.risk_aggregator import run_full_aggregation
from app.core.tag_suggester import TagSuggester
import logging

logger = logging.getLogger(__name__)


def run_aggregator():
    """
    Scheduled via APScheduler (every 60 minutes).
    Full rebuild of `risk_cells` from incidents, reports, and passive data.
    Also retrains the tag suggester model.
    """
    logger.info("Running aggregator worker to rebuild risk cells...")
    with SessionLocal() as db:
        try:
            result = run_full_aggregation(db)
            logger.info(
                f"Aggregator finished: upserted={result['upserted']}, "
                f"filled={result['filled']}, "
                f"incident_cells={result['incident_cells']}, "
                f"report_cells={result['report_cells']}"
            )
            
            # Retrain tag suggester
            suggester = TagSuggester()
            retrain_result = suggester.retrain_from_db(db)
            logger.info(f"Tag suggester: {retrain_result}")
            
        except Exception as e:
            logger.error(f"Aggregator error: {e}")
            raise