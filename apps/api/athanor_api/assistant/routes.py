"""HTTP routes for the in-app assistant, with optional vault authentication."""

from __future__ import annotations

from typing import Annotated, Any, NoReturn

import anyio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from athanor_api.assistant.ask import answer_question
from athanor_api.assistant.draft import AssistantError, DraftError, generate_draft
from athanor_api.assistant.token import require_assistant_token
from athanor_api.model_endpoints import EndpointInfo, discover_endpoints, probe_endpoint
from athanor_api.vault.routes import require_loopback

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])
Loopback = Annotated[None, Depends(require_loopback)]
DISCOVERY_LIMITER = anyio.CapacityLimiter(2)


@router.get("/startup-endpoint")
async def startup_model_endpoint(request: Request, _: Loopback) -> dict[str, list[EndpointInfo]]:
    endpoint = getattr(request.app.state, "startup_model_endpoint", None)
    return {"items": [endpoint] if endpoint else []}


class DiscoverRequest(BaseModel):
    endpoint: str = Field(default="", max_length=2048)
    use_token: bool = Field(default=False, alias="useToken")


@router.post("/endpoints")
async def discover_model_endpoints(
    body: DiscoverRequest, _: Loopback
) -> dict[str, list[EndpointInfo]]:
    endpoint = body.endpoint.strip()
    try:
        if body.use_token and not endpoint:
            raise HTTPException(status_code=400, detail="Choose an endpoint before using a token.")
        token = require_assistant_token() if body.use_token else ""
        if endpoint:
            result = await anyio.to_thread.run_sync(
                lambda: probe_endpoint(endpoint, token=token, timeout=3), limiter=DISCOVERY_LIMITER
            )
            return {"items": [result] if result else []}
        results = await anyio.to_thread.run_sync(discover_endpoints, limiter=DISCOVERY_LIMITER)
        return {"items": results}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AssistantError as exc:
        _raise_assistant(exc)


class AssistantWorkflow(BaseModel):
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    transitions: list[dict[str, Any]] = Field(default_factory=list)
    input: str = ""
    availableTools: list[dict[str, Any]] = Field(default_factory=list)


class DraftRequest(BaseModel):
    endpoint: str
    model: str = "assistant"
    use_token: bool = Field(default=True, alias="useToken")
    workflow: AssistantWorkflow
    target_task_ids: list[str] | None = Field(default=None, alias="targetTaskIds")


class Passage(BaseModel):
    label: str
    text: str


class AskRequest(BaseModel):
    endpoint: str
    model: str = "assistant"
    use_token: bool = Field(default=True, alias="useToken")
    question: str
    passages: list[Passage] = Field(default_factory=list)


def _raise_assistant(exc: AssistantError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/draft")
async def draft_architecture(body: DraftRequest, _: Loopback) -> dict[str, Any]:
    endpoint = body.endpoint.strip()
    if not endpoint:
        raise HTTPException(status_code=400, detail="Set the assistant model endpoint.")
    try:
        token = require_assistant_token() if body.use_token else ""
        return await anyio.to_thread.run_sync(
            lambda: generate_draft(
                endpoint=endpoint,
                model=body.model.strip() or "assistant",
                workflow=body.workflow.model_dump(),
                token=token,
                target_task_ids=body.target_task_ids,
            )
        )
    except AssistantError as exc:
        _raise_assistant(exc)
    except DraftError as exc:
        raise HTTPException(status_code=422, detail="; ".join(exc.messages)) from exc


@router.post("/ask")
async def ask_assistant(body: AskRequest, _: Loopback) -> dict[str, str]:
    endpoint = body.endpoint.strip()
    question = body.question.strip()
    if not endpoint:
        raise HTTPException(status_code=400, detail="Set the assistant model endpoint.")
    if not question:
        raise HTTPException(status_code=400, detail="Enter a question.")
    try:
        token = require_assistant_token() if body.use_token else ""
        answer = await anyio.to_thread.run_sync(
            lambda: answer_question(
                endpoint=endpoint,
                model=body.model.strip() or "assistant",
                token=token,
                question=question,
                passages=[passage.model_dump() for passage in body.passages],
            )
        )
    except AssistantError as exc:
        _raise_assistant(exc)
    return {"answer": answer}
