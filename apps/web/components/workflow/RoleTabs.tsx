"use client";
import { Tab, TabTitleText, Tabs } from "@patternfly/react-core";

import {
  useUiPreferencesStore,
  type WorkspaceRole,
} from "@/store/ui-preferences-store";
import { useSelectionStore } from "@/store/selection-store";

export const ROLES: {
  id: WorkspaceRole;
  label: string;
  description: string;
}[] = [
  {
    id: "sme",
    label: "Subject Matter Expert",
    description: "Define tasks, constraints, and workflow stages",
  },
  {
    id: "engineer",
    label: "AI Engineer",
    description: "Configure each task’s agents and components",
  },
  {
    id: "security",
    label: "AgentOpSec Engineer",
    description: "Review controls, overrides, and unused connections",
  },
];

export function RoleTabs() {
  const role = useUiPreferencesStore((s) => s.workspaceRole);
  const select = (next: WorkspaceRole) => {
    useSelectionStore.getState().clearSelection();
    useUiPreferencesStore.getState().setWorkspaceRole(next);
  };
  return (
    <Tabs
      activeKey={role}
      onSelect={(_event, key) => select(key as WorkspaceRole)}
      aria-label="Role views"
      id="role-tabs"
    >
      {ROLES.map((item) => (
        <Tab
          key={item.id}
          eventKey={item.id}
          id={`role-${item.id}`}
          aria-controls="role-workspace"
          title={<TabTitleText><span title={item.description}>{item.label}</span></TabTitleText>}
        />
      ))}
    </Tabs>
  );
}
