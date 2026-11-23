"use client";

/**
 * Confirm/cancel banner for deletes requested from the canvas or inspector.
 */
import { Alert, AlertActionLink } from "@patternfly/react-core";

import { usePendingDeleteStore } from "@/store/pending-delete-store";
import { useProjectStore } from "@/store/project-store";

export function DeleteConfirmationPanel() {
  const pending = usePendingDeleteStore((state) => state.pending);
  const cancelDelete = usePendingDeleteStore((state) => state.cancelDelete);
  const confirmDelete = usePendingDeleteStore((state) => state.confirmDelete);
  const nodes = useProjectStore((state) => state.graph.nodes);
  const edges = useProjectStore((state) => state.graph.edges);

  if (!pending) return null;

  const nodeNames = pending.nodeIds.map((id) => {
    const node = nodes.find((item) => item.id === id);
    return node?.name ?? id;
  });
  const edgeCount = edges.filter(
    (edge) =>
      pending.edgeIds.includes(edge.id) ||
      pending.nodeIds.includes(edge.sourceNodeId) ||
      pending.nodeIds.includes(edge.targetNodeId),
  ).length;

  return (
    <Alert
      variant="danger"
      title="Confirm delete"
      isInline
      actionLinks={
        <>
          <AlertActionLink onClick={confirmDelete}>Delete</AlertActionLink>
          <AlertActionLink onClick={cancelDelete}>Cancel</AlertActionLink>
        </>
      }
    >
      {nodeNames.length > 0 && (
        <>
          Remove{" "}
          {nodeNames.length === 1 ? `“${nodeNames[0]}”` : `${nodeNames.length} nodes`}
          {nodeNames.length > 1 && (
            <span>
              {" "}
              {nodeNames.slice(0, 4).join(", ")}
              {nodeNames.length > 4 ? ` +${nodeNames.length - 4} more` : ""}
            </span>
          )}
        </>
      )}
      {edgeCount > 0 && (
        <>
          {nodeNames.length > 0 ? " and " : "Remove "}
          {edgeCount} connection{edgeCount === 1 ? "" : "s"}
        </>
      )}
      . You can restore this with Undo (Ctrl/Cmd+Z).
    </Alert>
  );
}
