"use client";

import { useDragNode } from "@patternfly/react-topology";

import { isSpacePan } from "../navigation";

/** Header drag handle. Space-pan takes priority over moving the node. */
export function useCardDrag() {
  return useDragNode({ canDrag: () => !isSpacePan() });
}
