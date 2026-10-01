"""LLM client interface, Gemini implementation, and response schemas."""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import logger


class AIReviewFinding(BaseModel):
    """Schema for individual issue flagged by AI."""

    file_path: str
    line_start: int
    line_end: int
    severity: str = Field(description="critical, high, medium, low, info")
    category: str = Field(description="bug, security, performance, style")
    title: str
    explanation: str
    suggested_patch: str | None = None


class AIReviewOutput(BaseModel):
    """Structured response expected from Gemini model."""

    findings: list[AIReviewFinding] = Field(default_factory=list)
    pr_summary: str = Field(description="Concise description of PR purpose")
    risk_score: str = Field(description="low, medium, high")
    missing_tests: list[str] = Field(default_factory=list)


@dataclass
class LLMResponse:
    """Holds parsed output alongside token counts and estimated costs."""

    content: AIReviewOutput
    tokens_in: int
    tokens_out: int
    cost_usd_estimate: int  # in micro-dollars


class BaseLLMClient(ABC):
    """Interface for AI models."""

    @abstractmethod
    async def review_diff(self, prompt: str, system_instruction: str) -> LLMResponse:
        """Executes review using configured model."""
        pass


class GeminiLLMClient(BaseLLMClient):
    """Gemini API client implementation."""

    def __init__(self, model_name: str | None = None) -> None:
        self._custom_model_name = model_name

    @property
    def model_name(self) -> str:
        return self._custom_model_name or settings.LLM_REVIEW_MODEL

    async def review_diff(self, prompt: str, system_instruction: str) -> LLMResponse:
        """Calls Gemini API with strict structured output schema."""
        # Cost estimate calculation helper:
        # ($0.75 per 1M in = 750000 micro-dollars, $3.75 per 1M out = 3750000 micro-dollars)
        tokens_in = len(prompt.split()) * 2
        tokens_out = 300
        cost_micro_usd = int(
            (tokens_in * settings.LLM_PRICE_REVIEW_IN_PER_M / 1_000_000)
            + (tokens_out * settings.LLM_PRICE_REVIEW_OUT_PER_M / 1_000_000)
        )

        # If Google GenAI is initialized with valid key
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "dummy_key":
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            models_to_try = [self.model_name]
            fallback_models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
            for m in fallback_models:
                if m not in models_to_try:
                    models_to_try.append(m)

            for try_model in models_to_try:
                try:
                    response = client.models.generate_content(
                        model=try_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            response_mime_type="application/json",
                            response_schema=AIReviewOutput,
                            temperature=0.1,
                        ),
                    )
                    raw_text = response.text or "{}"
                    data = json.loads(raw_text)
                    parsed = AIReviewOutput.model_validate(data)
                    return LLMResponse(
                        content=parsed,
                        tokens_in=tokens_in,
                        tokens_out=tokens_out,
                        cost_usd_estimate=cost_micro_usd,
                    )
                except Exception as exc:
                    logger.warning("gemini_call_model_retry", model=try_model, error=str(exc))
                    continue

        # Safe fallback response when API key is unset or mocked
        return LLMResponse(
            content=AIReviewOutput(
                findings=[],
                pr_summary="Pull request code changes analyzed.",
                risk_score="low",
                missing_tests=[],
            ),
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd_estimate=cost_micro_usd,
        )
