from loguru import logger


def log_usage(phase: str, usage, section_type: str | None = None) -> None:
    """Log token usage from an Azure OpenAI response."""
    if usage is None:
        return
    label = f"{phase}:{section_type}" if section_type else phase
    logger.info(
        "[token_budget] {} | prompt={} completion={} total={}",
        label,
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
        getattr(usage, "total_tokens", "?"),
    )
