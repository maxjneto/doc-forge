import logging
import sys

from loguru import logger


NOISY_LOGGER_MIN_LEVELS: dict[str, int] = {
    "httpcore": logging.WARNING,
    "httpx": logging.WARNING,
    "inngest._internal.comm_lib": logging.WARNING,
    "inngest._internal.comm_lib.handler": logging.WARNING,
}


def _should_drop(name: str, level_no: int, message: str) -> bool:
    # Inngest's dev server calls this endpoint frequently, which buries workflow logs.
    if name.startswith("uvicorn") and "/api/inngest" in message:
        return True

    # Explicitly suppress noisy comm-lib sync chatter in development.
    if name.startswith("inngest._internal.comm_lib") and level_no < logging.WARNING:
        return True

    for logger_name, min_level in NOISY_LOGGER_MIN_LEVELS.items():
        if name == logger_name or name.startswith(f"{logger_name}."):
            return level_no < min_level

    return False


def _should_drop_record(record: logging.LogRecord) -> bool:
    return _should_drop(record.name, record.levelno, record.getMessage())


def _loguru_sink_filter(record: dict) -> bool:
    return not _should_drop(
        str(record.get("name") or ""),
        int(record["level"].no),
        str(record.get("message") or ""),
    )


class _InterceptHandler(logging.Handler):
    """Route stdlib logging records into loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        if _should_drop_record(record):
            return

        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Walk up the call stack to find the real caller
        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging(level: str = "DEBUG") -> None:
    """Configure loguru as the single logging sink for the whole app."""
    logger.remove()

    logger.add(
        sys.stderr,
        level=level,
        filter=_loguru_sink_filter,
        format=(
            "<green>{time:HH:mm:ss.SSS}</green> "
            "<level>{level: <8}</level> "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan> | "
            "{message}"
        ),
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # Redirect every stdlib logger (uvicorn, sqlalchemy, inngest, …) through loguru
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)

    for logger_name, min_level in NOISY_LOGGER_MIN_LEVELS.items():
        logging.getLogger(logger_name).setLevel(min_level)

    for name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "sqlalchemy.engine",
        "inngest",
    ):
        log = logging.getLogger(name)
        log.handlers = [_InterceptHandler()]
        log.propagate = False
