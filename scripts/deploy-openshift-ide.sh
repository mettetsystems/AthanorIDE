#!/usr/bin/env bash
# Build AthanorIDE and deploy it to OpenShift.
# Publishes images to Quay when a registry and push credentials are available,
# otherwise to the cluster's internal image registry. Stops before the build
# when neither destination is available.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${ATHANOR_NAMESPACE:-athanoride}"
IMAGE_TAG="${ATHANOR_IMAGE_TAG:-latest}"
INTERNAL_REGISTRY="image-registry.openshift-image-registry.svc:5000"
CHECK_ONLY=0

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: scripts/deploy-openshift-ide.sh [--check]" >&2
  exit 2
fi

if ! command -v oc >/dev/null 2>&1; then
  echo "The OpenShift CLI (oc) is required." >&2
  exit 1
fi

if ! whoami_out="$(oc whoami --request-timeout=15s 2>&1)"; then
  if grep -q 'connection to the server' <<<"${whoami_out}"; then
    echo "Cannot reach the OpenShift API. Confirm the cluster is up, then log in with oc." >&2
  else
    echo "Log in to the cluster with oc before deploying AthanorIDE." >&2
  fi
  printf '%s\n' "${whoami_out}" >&2
  exit 1
fi

internal_registry_enabled() {
  local state ready
  state="$(oc get configs.imageregistry.operator.openshift.io cluster -o jsonpath='{.spec.managementState}' 2>/dev/null || true)"
  if [[ "${state}" != "Managed" && "${state}" != "Unmanaged" ]]; then
    return 1
  fi
  ready="$(oc get deploy image-registry -n openshift-image-registry -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  [[ -n "${ready}" && "${ready}" -ge 1 ]]
}

discover_quay() {
  local endpoint host namespace_name
  endpoint="$(oc get quayregistries.quay.redhat.com -A -o jsonpath='{.items[0].status.registryEndpoint}' 2>/dev/null || true)"
  host="${endpoint#https://}"
  host="${host#http://}"
  host="${host%%/*}"
  if [[ -z "${host}" ]]; then
    return 1
  fi
  namespace_name="${QUAY_NAMESPACE:-${QUAY_ORGANIZATION:-}}"
  if [[ -z "${namespace_name}" ]]; then
    return 1
  fi
  QUAY_REGISTRY="${host}"
  QUAY_NAMESPACE="${namespace_name}"
}

quay_credentials_present() {
  [[ -n "${QUAY_USER:-}" && -n "${QUAY_PASSWORD:-}${QUAY_TOKEN:-}" ]]
}

choose_destination() {
  DESTINATION=""
  if [[ -n "${QUAY_REGISTRY:-}" && -n "${QUAY_NAMESPACE:-${QUAY_ORGANIZATION:-}}" ]]; then
    QUAY_REGISTRY="${QUAY_REGISTRY#https://}"
    QUAY_REGISTRY="${QUAY_REGISTRY#http://}"
    QUAY_REGISTRY="${QUAY_REGISTRY%%/*}"
    QUAY_NAMESPACE="${QUAY_NAMESPACE:-${QUAY_ORGANIZATION}}"
  else
    discover_quay || true
  fi

  if [[ -n "${QUAY_REGISTRY:-}" && -n "${QUAY_NAMESPACE:-}" ]] && quay_credentials_present; then
    DESTINATION="quay"
    return 0
  fi
  if [[ -n "${QUAY_REGISTRY:-}" && -n "${QUAY_NAMESPACE:-}" ]] && ! quay_credentials_present; then
    echo "Quay at ${QUAY_REGISTRY} needs QUAY_USER and QUAY_PASSWORD (or QUAY_TOKEN) before images can be pushed there." >&2
  fi
  if internal_registry_enabled; then
    DESTINATION="internal"
    return 0
  fi
  return 1
}

print_registry_help() {
  cat >&2 <<EOF
This build needs a registry to publish the AthanorIDE images.

Quay is not ready to receive them, and the OpenShift internal image registry is not enabled.
Enable the internal registry, wait until it is ready, then run this script again:

  oc patch configs.imageregistry.operator.openshift.io/cluster \\
    --type=merge -p '{"spec":{"managementState":"Managed"}}'
  oc get pods -n openshift-image-registry

To publish to Quay instead, set these before running the script:

  QUAY_REGISTRY   registry hostname, for example quay.io
  QUAY_NAMESPACE  Quay organization or user that will own the images
  QUAY_USER       robot or user allowed to push
  QUAY_PASSWORD   password or token (QUAY_TOKEN is also accepted)
EOF
}

enable_internal_registry() {
  echo "==> Enabling the OpenShift internal image registry"
  oc patch configs.imageregistry.operator.openshift.io/cluster \
    --type=merge -p '{"spec":{"managementState":"Managed"}}' >/dev/null
  echo "==> Waiting for the image-registry deployment"
  local attempt ready
  for attempt in $(seq 1 60); do
    ready="$(oc get deploy image-registry -n openshift-image-registry -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
    if [[ -n "${ready}" && "${ready}" -ge 1 ]]; then
      return 0
    fi
    sleep 5
  done
  echo "The internal image registry did not become ready. Check pods in openshift-image-registry, then run this script again." >&2
  return 1
}

prompt_for_internal_registry() {
  print_registry_help
  if [[ "${CHECK_ONLY}" -eq 1 || ! -t 0 ]]; then
    exit 1
  fi
  local answer
  read -r -p "Enable the internal image registry now and continue the build? [y/N] " answer
  case "${answer}" in
    y|Y|yes|YES)
      enable_internal_registry
      DESTINATION="internal"
      ;;
    *)
      echo "Build stopped. Enable the internal image registry or configure Quay, then run this script again." >&2
      exit 1
      ;;
  esac
}

if ! choose_destination; then
  prompt_for_internal_registry
fi

if [[ "${DESTINATION}" == "quay" ]]; then
  WEB_IMAGE="${QUAY_REGISTRY}/${QUAY_NAMESPACE}/athanoride-web:${IMAGE_TAG}"
  API_IMAGE="${QUAY_REGISTRY}/${QUAY_NAMESPACE}/athanoride-api:${IMAGE_TAG}"
  echo "==> Quay is available. Images will be published to ${QUAY_REGISTRY}/${QUAY_NAMESPACE}"
else
  WEB_IMAGE="${INTERNAL_REGISTRY}/${NAMESPACE}/athanoride-web:${IMAGE_TAG}"
  API_IMAGE="${INTERNAL_REGISTRY}/${NAMESPACE}/athanoride-api:${IMAGE_TAG}"
  echo "==> Internal image registry is enabled. Images will be published to ${INTERNAL_REGISTRY}/${NAMESPACE}"
fi

if [[ "${CHECK_ONLY}" -eq 1 ]]; then
  exit 0
fi

echo "==> Ensuring namespace ${NAMESPACE}"
oc apply -f "${ROOT_DIR}/deploy/openshift-ide/namespace.yaml"

if ! oc -n "${NAMESPACE}" get secret athanoride-oauth >/dev/null 2>&1; then
  echo "==> Creating the OAuth cookie secret"
  oc -n "${NAMESPACE}" create secret generic athanoride-oauth \
    --from-literal=cookie-secret="$(openssl rand -base64 32)"
fi

echo "==> Applying image build configuration"
oc apply -f "${ROOT_DIR}/deploy/openshift-ide/builds.yaml"

if [[ "${DESTINATION}" == "quay" ]]; then
  quay_password="${QUAY_PASSWORD:-${QUAY_TOKEN}}"
  oc -n "${NAMESPACE}" create secret docker-registry athanoride-quay-push \
    --docker-server="${QUAY_REGISTRY}" \
    --docker-username="${QUAY_USER}" \
    --docker-password="${quay_password}" \
    --dry-run=client -o yaml | oc apply -f -
  oc -n "${NAMESPACE}" secrets link builder athanoride-quay-push --for=pull,mount >/dev/null
  for build_name in athanoride-web athanoride-api; do
    image_ref="${WEB_IMAGE}"
    if [[ "${build_name}" == "athanoride-api" ]]; then
      image_ref="${API_IMAGE}"
    fi
    oc patch "bc/${build_name}" -n "${NAMESPACE}" --type=json -p "$(cat <<EOF
[{"op":"replace","path":"/spec/output","value":{"to":{"kind":"DockerImage","name":"${image_ref}"},"pushSecret":{"name":"athanoride-quay-push"}}}]
EOF
)" >/dev/null
  done
else
  oc patch bc/athanoride-web -n "${NAMESPACE}" --type=json -p "$(cat <<'EOF'
[{"op":"replace","path":"/spec/output","value":{"to":{"kind":"ImageStreamTag","name":"athanoride-web:latest"}}}]
EOF
)" >/dev/null
  oc patch bc/athanoride-api -n "${NAMESPACE}" --type=json -p "$(cat <<'EOF'
[{"op":"replace","path":"/spec/output","value":{"to":{"kind":"ImageStreamTag","name":"athanoride-api:latest"}}}]
EOF
)" >/dev/null
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/athanor-deploy.XXXXXX")"
ARCHIVE="${WORKDIR}/context.tar.gz"
cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

echo "==> Packing the build context"
COPYFILE_DISABLE=1 tar --format ustar -czf "${ARCHIVE}" \
  --exclude node_modules \
  --exclude .git \
  --exclude .tools \
  --exclude .next \
  --exclude .venv \
  --exclude __pycache__ \
  --exclude .ruff_cache \
  --exclude .cursor \
  -C "${ROOT_DIR}" .

start_build() {
  local config_name="$1"
  local started name
  echo "==> Starting build ${config_name}" >&2
  if ! started="$(oc start-build "${config_name}" --from-archive="${ARCHIVE}" -n "${NAMESPACE}" 2>&1)"; then
    printf '%s\n' "${started}" >&2
    return 1
  fi
  name="$(printf '%s\n' "${started}" | awk '/started$/ { print $1 }' | tail -n 1)"
  name="${name##*/}"
  if [[ -z "${name}" ]]; then
    printf '%s\n' "${started}" >&2
    return 1
  fi
  printf '%s' "${name}"
}

wait_for_build() {
  local name="$1"
  local phase deadline
  echo "==> Waiting for build ${name}"
  deadline="$((SECONDS + 1800))"
  while (( SECONDS < deadline )); do
    phase="$(oc get "build/${name}" -n "${NAMESPACE}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
    case "${phase}" in
      Complete)
        echo "==> Build ${name} completed"
        return 0
        ;;
      Failed|Error|Cancelled)
        echo "Build ${name} ended with status ${phase}. See: oc logs -n ${NAMESPACE} build/${name}" >&2
        return 1
        ;;
      "")
        sleep 2
        ;;
      *)
        sleep 10
        ;;
    esac
  done
  echo "Build ${name} did not finish within 30 minutes. See: oc logs -n ${NAMESPACE} build/${name}" >&2
  return 1
}

API_BUILD="$(start_build athanoride-api)"
WEB_BUILD="$(start_build athanoride-web)"
wait_for_build "${API_BUILD}"
wait_for_build "${WEB_BUILD}"

echo "==> Applying the application manifests"
oc apply -k "${ROOT_DIR}/deploy/openshift-ide"
if [[ "${DESTINATION}" == "quay" ]]; then
  oc -n "${NAMESPACE}" secrets link athanoride-auth athanoride-quay-push --for=pull >/dev/null
fi
oc -n "${NAMESPACE}" set image "deployment/athanoride" \
  "web=${WEB_IMAGE}" \
  "api=${API_IMAGE}"
oc -n "${NAMESPACE}" rollout restart "deployment/athanoride"
oc -n "${NAMESPACE}" rollout status "deployment/athanoride" --timeout=180s
echo "==> Route:"
oc -n "${NAMESPACE}" get route athanoride
