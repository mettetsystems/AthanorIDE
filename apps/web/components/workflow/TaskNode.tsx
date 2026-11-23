"use client";

import { useEffect, useState } from "react";
import { FormGroup, TextArea } from "@patternfly/react-core";

/** Inline brief field used on workflow task cards and in the inspector. */
export function BriefField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <FormGroup label={label} fieldId={`brief-${label}`}>
      <TextArea
        id={`brief-${label}`}
        rows={2}
        value={draft}
        onChange={(_event, next) => setDraft(next)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
      />
    </FormGroup>
  );
}
