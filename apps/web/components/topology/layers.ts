/** Named PatternFly topology layers. `default` is required by LayersProvider. */
export const SWIMLANE_LAYER = "swimlanes";
export const TASK_GROUP_LAYER = "task-groups";
export const TOPOLOGY_LAYERS = [
  "bottom",
  SWIMLANE_LAYER,
  TASK_GROUP_LAYER,
  "default",
  "top",
] as const;

export const SNAP = 16;

export function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}
