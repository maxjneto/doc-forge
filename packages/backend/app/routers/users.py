from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter(tags=["users"])


@router.get("/users/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "credits": current_user.credits,
        "weekly_credits": settings.WEEKLY_CREDITS,
    }
