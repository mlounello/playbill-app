"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type TabItem = {
  id: string;
  label: string;
};

const tabIcons: Record<string, string> = {
  overview: "OV",
  "program-plan": "PL",
  "people-roles": "PR",
  submissions: "SU",
  preview: "PV",
  export: "EX",
  publish: "PB",
  settings: "ST"
};

export function WorkspaceTabs({
  tabs,
  showId,
  activeTab
}: {
  tabs: TabItem[];
  showId: string;
  activeTab: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="stack-sm">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          className="tab-chip"
          style={activeTab === item.id ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
          onClick={() => {
            if (activeTab === item.id) return;
            startTransition(() => {
              router.push(`/app/shows/${showId}?tab=${item.id}`);
            });
          }}
          aria-current={activeTab === item.id ? "page" : undefined}
          aria-label={`Open ${item.label} tab`}
        >
          <span className="tab-chip-content">
            <span className="tab-icon-badge" aria-hidden>{tabIcons[item.id] ?? "•"}</span>
            <span>{item.label}</span>
          </span>
        </button>
      ))}
      {isPending ? <div className="tab-loading-indicator" aria-live="polite">Loading tab...</div> : null}
    </div>
  );
}
