"""FastAPI entrypoint for AthanorIDE API."""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from functools import partial

import anyio
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.applications import Starlette
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.routing import Mount

from athanor_api.assistant.mcp_server import build_assistant_http_app
from athanor_api.assistant.routes import router as assistant_router
from athanor_api.catalog import FOUNDATION_NODE_SUMMARIES
from athanor_api.compiler import compile_transformation, validate_compiled_source
from athanor_api.execution import execute_architecture_graph
from athanor_api.exporter import ExportError, export_architecture_graph
from athanor_api.exporter.handoff import create_handoff
from athanor_api.logging_config import bind_correlation_id, configure_logging
from athanor_api.marketplace import (
    MARKETPLACE_TOPICS,
    MarketplaceSnapshot,
    MarketplaceTopic,
    refresh_marketplace,
)
from athanor_api.model_endpoints import probe_endpoint
from athanor_api.schemas.api import (
    AuditRecordModel,
    CompilerGenerateRequest,
    CompilerGenerateResponse,
    CompilerValidateRequest,
    CompilerValidateResponse,
    CorrectionAttemptModel,
    EdgePayloadModel,
    ErrorResponse,
    ExecuteProjectRequest,
    ExecuteProjectResponse,
    ExecutionStepModel,
    ExportProjectRequest,
    ExportProjectResponse,
    HandoffRequest,
    HandoffResponse,
    HealthResponse,
    ManifestEntryModel,
    NodeDefinitionsResponse,
    SandboxResultModel,
    ValidateProjectRequest,
    ValidateProjectResponse,
)
from athanor_api.schemas.graph import SCHEMA_VERSION
from athanor_api.settings import settings
from athanor_api.validation import validate_architecture_graph
from athanor_api.vault.routes import router as vault_router

configure_logging()
logger = logging.getLogger(__name__)
CPU_WORK_LIMITER = anyio.CapacityLimiter(2)


class WorkerCapacityError(Exception):
    """The bounded CPU worker pool is at capacity."""


async def run_cpu_bound[ResultT](
    function: Callable[..., ResultT], /, *args: object, **kwargs: object
) -> ResultT:
    """Run blocking validation/execution/export work off the ASGI event loop."""

    try:
        CPU_WORK_LIMITER.acquire_nowait()
    except anyio.WouldBlock as exc:
        raise WorkerCapacityError from exc
    try:
        return await anyio.to_thread.run_sync(partial(function, *args, **kwargs))
    finally:
        CPU_WORK_LIMITER.release()


def _install_assistant_mount(parent: FastAPI) -> None:
    parent.router.routes = [
        route
        for route in parent.router.routes
        if not (isinstance(route, Mount) and route.path == "/assistant")
    ]
    parent.mount("/assistant", build_assistant_http_app())


@asynccontextmanager
async def app_lifespan(parent: FastAPI) -> AsyncIterator[None]:
    # Complete the read-only Maya check before accepting requests.
    maya = await anyio.to_thread.run_sync(
        partial(probe_endpoint, "http://127.0.0.1:8080/v1", timeout=1.0)
    )
    parent.state.startup_model_endpoint = (
        maya if maya and maya["status"] == "ready" else None
    )
    logger.info(
        "Project Maya startup check: %s",
        "available"
        if parent.state.startup_model_endpoint
        else "not ready; keeping configured endpoint",
    )
    _install_assistant_mount(parent)
    mounted = next(
        route
        for route in parent.router.routes
        if isinstance(route, Mount) and route.path == "/assistant"
    )
    http_app = mounted.app
    if not isinstance(http_app, Starlette):
        raise RuntimeError("Assistant MCP mount is not a Starlette app")
    async with http_app.router.lifespan_context(http_app):
        yield


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=app_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vault_router)
app.include_router(assistant_router)
_install_assistant_mount(app)


@app.get("/api/v1/marketplace/topics", response_model=list[MarketplaceTopic], tags=["marketplace"])
async def marketplace_topics() -> list[MarketplaceTopic]:
    """List marketplace capability areas without requiring external services."""

    return [MarketplaceTopic(id=key, label=value) for key, value in MARKETPLACE_TOPICS.items()]


@app.post("/api/v1/marketplace/refresh", response_model=MarketplaceSnapshot, tags=["marketplace"])
async def marketplace_refresh() -> MarketplaceSnapshot:
    """Refresh public npm package metadata and exact-version OSV advisories."""

    started = time.perf_counter()
    snapshot = await run_cpu_bound(refresh_marketplace)
    logger.info(
        "marketplace refresh duration_ms=%.2f entries=%s unavailable_topics=%s",
        (time.perf_counter() - started) * 1000,
        len(snapshot.entries),
        len(snapshot.unavailable_topics),
    )
    return snapshot


@app.middleware("http")
async def correlation_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    bind_correlation_id(correlation_id)
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response


def _error_payload(
    *,
    error: str,
    message: str,
    correlation_id: str,
    details: dict[str, object] | None = None,
) -> dict[str, object]:
    body = ErrorResponse(
        error=error,
        message=message,
        correlationId=correlation_id,
        details=details,
    )
    return body.model_dump(by_alias=True)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    correlation_id = request.headers.get("X-Correlation-ID") or "-"
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(
            error="http_error",
            message=detail,
            correlation_id=correlation_id,
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    correlation_id = request.headers.get("X-Correlation-ID") or "-"
    return JSONResponse(
        status_code=422,
        content=_error_payload(
            error="validation_error",
            message="Request validation failed",
            correlation_id=correlation_id,
            details={"issues": exc.errors()},
        ),
    )


@app.exception_handler(WorkerCapacityError)
async def worker_capacity_exception_handler(
    request: Request, exc: WorkerCapacityError
) -> JSONResponse:
    del exc
    correlation_id = request.headers.get("X-Correlation-ID") or "-"
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": "2"},
        content=_error_payload(
            error="worker_capacity",
            message="Athanor is processing its maximum number of background jobs. Retry shortly.",
            correlation_id=correlation_id,
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Never return raw stack traces to clients.
    del exc
    correlation_id = request.headers.get("X-Correlation-ID") or "-"
    return JSONResponse(
        status_code=500,
        content=_error_payload(
            error="internal_error",
            message="An unexpected error occurred",
            correlation_id=correlation_id,
        ),
    )


@app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    """Liveness/readiness probe for local and containerized deployments."""

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.api_version,
        schemaVersion=SCHEMA_VERSION,
    )


@app.get(
    "/api/v1/node-definitions",
    response_model=NodeDefinitionsResponse,
    tags=["catalog"],
)
async def node_definitions() -> NodeDefinitionsResponse:
    """Return the declarative foundation node catalog."""

    return NodeDefinitionsResponse(items=list(FOUNDATION_NODE_SUMMARIES))


@app.post(
    "/api/v1/projects/validate",
    response_model=ValidateProjectResponse,
    tags=["projects"],
)
async def validate_project(body: ValidateProjectRequest) -> ValidateProjectResponse:
    """Validate an architecture graph without executing the pipeline."""

    started = time.perf_counter()
    issues = await run_cpu_bound(validate_architecture_graph, body.graph, body.profile)
    duration_ms = (time.perf_counter() - started) * 1000
    error_count = sum(1 for issue in issues if issue.severity == "error")
    logger.info(
        "validation complete duration_ms=%.2f issue_count=%s error_count=%s",
        duration_ms,
        len(issues),
        error_count,
    )
    return ValidateProjectResponse(
        valid=error_count == 0,
        issues=issues,
        durationMs=round(duration_ms, 3),
    )


@app.post(
    "/api/v1/projects/execute",
    response_model=ExecuteProjectResponse,
    tags=["projects"],
)
async def execute_project(body: ExecuteProjectRequest) -> ExecuteProjectResponse:
    """Execute the graph for payload inspection (safe: no arbitrary host code)."""

    result = await run_cpu_bound(
        execute_architecture_graph,
        body.graph,
        override_text=body.override_text,
    )
    logger.info(
        "execution complete status=%s duration_ms=%.2f steps=%s",
        result.status,
        result.duration_ms,
        len(result.steps),
    )
    return ExecuteProjectResponse(
        status=result.status,
        durationMs=result.duration_ms,
        steps=[
            ExecutionStepModel(
                nodeId=step.node_id,
                nodeName=step.node_name,
                nodeType=step.node_type,
                status=step.status,
                inputs=step.inputs,
                outputs=step.outputs,
                message=step.message,
                durationMs=step.duration_ms,
            )
            for step in result.steps
        ],
        edgePayloads=[
            EdgePayloadModel(
                edgeId=item.edge_id,
                sourceNodeId=item.source_node_id,
                targetNodeId=item.target_node_id,
                value=item.value,
                contractType=item.contract_type,
            )
            for item in result.edge_payloads
        ],
        finalOutputs=result.final_outputs,
        validationIssueCount=result.validation_issue_count,
    )


@app.post(
    "/api/v1/projects/export",
    response_model=ExportProjectResponse,
    tags=["projects"],
)
async def export_project(body: ExportProjectRequest) -> ExportProjectResponse:
    """Export a validated architecture graph into a deterministic repository."""

    try:
        result = await run_cpu_bound(
            export_architecture_graph,
            body.graph,
            export_format=body.export_format,
            include_docker_compat=body.include_docker_compat,
            include_kubernetes=body.include_kubernetes,
            include_openshift=body.include_openshift,
            include_terraform=body.include_terraform,
            include_argo_cd=body.include_argo_cd,
            project_slug=body.project_slug,
        )
    except ExportError as exc:
        raise StarletteHTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return ExportProjectResponse(
        projectSlug=result.project_slug,
        files=result.files,
        manifest=[
            ManifestEntryModel(path=item.path, bytes=item.bytes, sha256=item.sha256)
            for item in result.manifest
        ],
        durationMs=result.duration_ms,
        fileCount=len(result.files),
        validationIssues=result.validation_issues,
        archiveBase64=result.archive_base64,
    )


@app.post("/api/v1/projects/handoff", response_model=HandoffResponse, tags=["projects"])
async def handoff_project(body: HandoffRequest) -> HandoffResponse:
    try:
        files, archive = await run_cpu_bound(create_handoff, body.graph)
    except ExportError as exc:
        raise StarletteHTTPException(status_code=400, detail=str(exc)) from exc
    return HandoffResponse(files=files, archiveBase64=archive)


def _audit_model(audit: object) -> AuditRecordModel:
    raw = audit.model_dump(by_alias=False)  # type: ignore[attr-defined]
    return AuditRecordModel(
        provider=raw["provider"],
        maxAttempts=raw["max_attempts"],
        attempts=[
            CorrectionAttemptModel(
                attempt=item["attempt"],
                stage=item["stage"],
                success=item["success"],
                message=item["message"],
                changed=item.get("changed", False),
                details=item.get("details") or {},
            )
            for item in raw["attempts"]
        ],
        finalStatus=raw["final_status"],
        warnings=raw.get("warnings") or [],
    )


def _sandbox_model(sandbox: object) -> SandboxResultModel:
    raw = sandbox.model_dump(by_alias=False)  # type: ignore[attr-defined]
    return SandboxResultModel(
        status=raw["status"],
        stdout=raw.get("stdout") or "",
        stderr=raw.get("stderr") or "",
        exitCode=raw.get("exit_code"),
        durationMs=raw.get("duration_ms"),
        reason=raw.get("reason"),
    )


@app.post(
    "/api/v1/compiler/generate",
    response_model=CompilerGenerateResponse,
    tags=["compiler"],
)
async def compiler_generate(body: CompilerGenerateRequest) -> CompilerGenerateResponse:
    """Compile a natural-language transformation through the safe pipeline."""

    started = time.perf_counter()
    artifacts = await run_cpu_bound(
        compile_transformation,
        instruction=body.instruction,
        input_schema=body.input_schema,
        output_schema=body.output_schema,
        sample_input=body.sample_input,
        provenance=body.provenance,
        require_sandbox=body.require_sandbox,
    )
    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "compiler generate status=%s duration_ms=%.2f corrections=%s",
        artifacts.audit.final_status,
        duration_ms,
        sum(1 for item in artifacts.audit.attempts if item.changed),
    )
    return CompilerGenerateResponse(
        status=artifacts.audit.final_status,
        sourceCode=artifacts.source_code,
        testCode=artifacts.test_code,
        spec=artifacts.spec.model_dump(),
        audit=_audit_model(artifacts.audit),
        sandbox=_sandbox_model(artifacts.sandbox),
        ruffOutput=artifacts.ruff_output,
        mypyOutput=artifacts.mypy_output,
        durationMs=round(duration_ms, 3),
    )


@app.post(
    "/api/v1/compiler/validate",
    response_model=CompilerValidateResponse,
    tags=["compiler"],
)
async def compiler_validate(body: CompilerValidateRequest) -> CompilerValidateResponse:
    """Validate previously generated transformation source."""

    started = time.perf_counter()
    artifacts = await run_cpu_bound(
        validate_compiled_source,
        body.source_code,
        sample_input=body.sample_input,
    )
    duration_ms = (time.perf_counter() - started) * 1000
    return CompilerValidateResponse(
        status=artifacts.audit.final_status,
        sourceCode=artifacts.source_code,
        audit=_audit_model(artifacts.audit),
        sandbox=_sandbox_model(artifacts.sandbox),
        ruffOutput=artifacts.ruff_output,
        mypyOutput=artifacts.mypy_output,
        durationMs=round(duration_ms, 3),
    )
