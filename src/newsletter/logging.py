"""Structured newsletter diagnostics without addresses, message bodies or secrets."""

import json
import logging


class NewsletterFormatter(logging.Formatter):
    """Allow only operational identifiers in newsletter logs."""

    def format(self, record: logging.LogRecord) -> str:
        """Serialize the event and a fixed set of safe diagnostic fields.

        Args:
            record: Application log event.

        Returns:
            A JSON object containing no arbitrary extra fields.
        """
        return json.dumps(
            {
                "event": record.getMessage(),
                "level": record.levelname,
                **{
                    key: getattr(record, key, None)
                    for key in ("member_id", "delivery_id", "checkout_id", "error_type")
                },
            }
        )


logger = logging.getLogger("newsletter")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(NewsletterFormatter())
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False
