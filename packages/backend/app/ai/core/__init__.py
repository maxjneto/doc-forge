from app.ai.core.client import DEFAULT_MODEL, GUARDRAIL_MODEL, client, posthog_client
from app.ai.core.output_cleaner import (
    clean_section_output,
    promote_h1_headings,
    strip_outer_markdown_fence,
    strip_redundant_section_heading,
)
from app.ai.core.prompt_loader import ConfigurationError, get_system_prompt, load_yaml_prompt
from app.ai.core.token_budget import log_usage
from app.ai.core.truncation import (
    BUDGET,
    CHAT_HISTORY_WINDOW,
    SECTION_MAX_CHARS,
    build_context_report,
    compress_chat_history,
    enforce_context_budget,
    truncate_chat_history,
    truncate_middle,
    truncate_section,
)

__all__ = [
    "client",
    "posthog_client",
    "DEFAULT_MODEL",
    "GUARDRAIL_MODEL",
    "truncate_section",
    "truncate_middle",
    "truncate_chat_history",
    "compress_chat_history",
    "enforce_context_budget",
    "build_context_report",
    "BUDGET",
    "SECTION_MAX_CHARS",
    "CHAT_HISTORY_WINDOW",
    "log_usage",
    "clean_section_output",
    "strip_outer_markdown_fence",
    "strip_redundant_section_heading",
    "promote_h1_headings",
    "get_system_prompt",
    "load_yaml_prompt",
    "ConfigurationError",
]
