"""Seed default subscription plans into the database."""

import asyncio
import uuid

from sqlalchemy import select

from app.db.models import Plan
from app.db.session import async_session_maker

PLANS_DATA = [
    {
        "key": "free",
        "name": "Free",
        "monthly_review_limit_public": 100,
        "monthly_review_limit_private": 20,
        "price_inr_paise": 0,
        "features_json": {
            "max_lines": 2000,
            "max_files": 40,
            "block_on_critical": False,
            "languages": ["python", "javascript", "typescript", "java"],
        },
    },
    {
        "key": "pro",
        "name": "Pro Developer",
        "monthly_review_limit_public": 500,
        "monthly_review_limit_private": 150,
        "price_inr_paise": 199900,  # ₹1,999 in paise
        "features_json": {
            "max_lines": 2000,
            "max_files": 40,
            "block_on_critical": True,
            "languages": ["python", "javascript", "typescript", "java"],
            "custom_rules": True,
        },
    },
    {
        "key": "team",
        "name": "Engineering Team",
        "monthly_review_limit_public": 2000,
        "monthly_review_limit_private": 1000,
        "price_inr_paise": 799900,  # ₹7,999 in paise
        "features_json": {
            "max_lines": 2000,
            "max_files": 40,
            "block_on_critical": True,
            "languages": ["python", "javascript", "typescript", "java"],
            "custom_rules": True,
            "slack_alerts": True,
        },
    },
]


async def seed_plans() -> None:
    """Inserts initial plans if not already present."""
    async with async_session_maker() as session:
        for plan_spec in PLANS_DATA:
            stmt = select(Plan).where(Plan.key == plan_spec["key"])
            res = await session.execute(stmt)
            existing = res.scalars().first()
            if not existing:
                plan = Plan(id=uuid.uuid4(), **plan_spec)
                session.add(plan)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_plans())
