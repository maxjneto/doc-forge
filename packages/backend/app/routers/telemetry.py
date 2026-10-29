"""Usage telemetry the MCP server reports about itself.

The backend already sees every MCP call as an API request (see the
`mcp_api_request` middleware in main.py), but only the MCP server knows which
tool ran and how much text it handed the agent. It posts that here, with the
agent's own API key, so the event lands on the right person in PostHog.
Nothing is stored in the database.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.models.user import User
from app.services.observability import capture_account_event

router = APIRouter(tags=["telemetry"])


class McpToolCall(BaseModel):
    tool: str = Field(min_length=1, max_length=80)
    ok: bool
    duration_ms: float = Field(ge=0, le=600_000)
    # Characters of text the tool returned to the agent: a proxy for the tokens it
    # costs (≈ 4 characters per token). Images are counted separately.
    response_chars: int = Field(ge=0, le=50_000_000)
    image_bytes: int = Field(default=0, ge=0, le=50_000_000)
    document_id: str | None = Field(default=None, max_length=64)
    # Tool-specific detail worth slicing by (map mode, number of ops…). Small and flat.
    detail: dict[str, str | int | float | bool] = Field(default_factory=dict, max_length=12)


@router.post("/telemetry/mcp-tool", status_code=204)
async def report_mcp_tool_call(payload: McpToolCall, current_user: User = Depends(get_current_user)):
    capture_account_event(
        current_user.id,
        "mcp_tool_called",
        {
            "tool": payload.tool,
            "ok": payload.ok,
            "duration_ms": round(payload.duration_ms, 1),
            "response_chars": payload.response_chars,
            "approx_tokens": round(payload.response_chars / 4),
            "image_bytes": payload.image_bytes,
            "document_id": payload.document_id,
            **{f"detail_{k}": v for k, v in payload.detail.items()},
        },
    )
