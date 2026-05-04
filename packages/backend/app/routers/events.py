from fastapi import APIRouter

router = APIRouter(tags=["events"])

# This router is reserved for Inngest webhook integration.
# The actual Inngest serve endpoint is configured in inngest_client.py
# and mounted separately if needed.
