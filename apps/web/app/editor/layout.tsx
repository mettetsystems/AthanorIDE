/** PatternFly styles load with the editor route, after the root Tailwind sheet. */
import "@patternfly/react-core/dist/styles/base.css";
import "@patternfly/react-topology/dist/esm/css/topology-components.css";
import "@patternfly/react-topology/dist/esm/css/topology-controlbar.css";
import "@patternfly/react-topology/dist/esm/css/topology-view.css";
import "@/components/topology/topology.css";
import "@/components/editor/editor.css";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
