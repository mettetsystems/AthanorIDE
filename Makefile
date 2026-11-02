.PHONY: install install-macos setup-model-endpoint bootstrap-tools dev stop lint typecheck test podman-up podman-down openshift-ide-apply clean help

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
TOOLS_DIR := $(ROOT_DIR)/.tools
export PATH := $(TOOLS_DIR):$(TOOLS_DIR)/py/bin:$(PATH)

PNPM ?= $(TOOLS_DIR)/pnpm
UV ?= $(shell command -v uv 2>/dev/null || echo $(TOOLS_DIR)/uv)

help:
	@echo "AthanorIDE Make targets:"
	@echo "  make install       Bootstrap tools and install dependencies"
	@echo "  make install-macos Guided macOS setup for Intel and Apple Silicon Macs"
	@echo "  make setup-model-endpoint Reuse an existing endpoint or set up local Qwen2.5-7B (Linux)"
	@echo "  make dev           Run API + web for local development"
	@echo "  make stop          Stop API + web processes from this checkout"
	@echo "  make lint          Lint TypeScript and Python"
	@echo "  make typecheck     Type-check TypeScript and Python"
	@echo "  make test          Run frontend and backend tests"
	@echo "  make podman-up     Start rootless Podman compose stack"
	@echo "  make podman-down   Stop Podman compose stack"
	@echo "  make openshift-ide-apply Apply IDE deployment manifests (images and OAuth secret must be prepared)"

bootstrap-tools:
	@bash "$(ROOT_DIR)/scripts/bootstrap-tools.sh"

install: bootstrap-tools
	@echo "==> Installing JavaScript workspace dependencies"
	@$(PNPM) install
	@UV="$(UV)" bash "$(ROOT_DIR)/scripts/sync-api.sh"
	@echo "==> Building shared TypeScript packages"
	@$(PNPM) --filter @athanor/contracts build
	@$(PNPM) --filter @athanor/node-definitions build
	@$(PNPM) --filter @athanor/ui build

install-macos:
	@bash "$(ROOT_DIR)/scripts/install-macos.sh"

setup-model-endpoint:
	@python3 "$(ROOT_DIR)/scripts/setup-model-endpoint.py"

dev: bootstrap-tools
	@echo "==> Rebuilding shared TypeScript packages (palette/catalog)"
	@$(PNPM) --filter @athanor/contracts build
	@$(PNPM) --filter @athanor/node-definitions build
	@$(PNPM) --filter @athanor/ui build
	@bash "$(ROOT_DIR)/scripts/dev.sh"

stop:
	@bash "$(ROOT_DIR)/scripts/stop.sh"

lint: bootstrap-tools
	@$(PNPM) lint
	@$(UV) run --directory "$(ROOT_DIR)/apps/api" ruff check athanor_api tests
	@$(UV) run --directory "$(ROOT_DIR)/apps/api" ruff format --check athanor_api tests

typecheck: bootstrap-tools
	@$(PNPM) typecheck
	@$(UV) run --directory "$(ROOT_DIR)/apps/api" mypy athanor_api

test: bootstrap-tools
	@$(PNPM) test
	@$(UV) run --directory "$(ROOT_DIR)/apps/api" pytest -q
	@python3 -m unittest discover -s "$(ROOT_DIR)/scripts/tests" -q

podman-up:
	@bash "$(ROOT_DIR)/scripts/podman-up.sh"

podman-down:
	@bash "$(ROOT_DIR)/scripts/podman-down.sh"

openshift-ide-apply:
	@oc apply -k "$(ROOT_DIR)/deploy/openshift-ide"

clean:
	@rm -rf "$(ROOT_DIR)/apps/web/.next" \
		"$(ROOT_DIR)/apps/api/.venv" \
		"$(ROOT_DIR)/packages/contracts/dist" \
		"$(ROOT_DIR)/packages/node-definitions/dist" \
		"$(ROOT_DIR)/packages/ui/dist"
	@find "$(ROOT_DIR)" -type d -name __pycache__ -prune -exec rm -rf {} +
