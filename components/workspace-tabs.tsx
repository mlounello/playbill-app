"use client";

import Link from "next/link";

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
  return (
    <div className="stack-sm">
      {tabs.map((item) => (
        <Link
          key={item.id}
          href={`/app/shows/${showId}?tab=${item.id}`}
          className="tab-chip"
          style={activeTab === item.id ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
          aria-current={activeTab === item.id ? "page" : undefined}
          aria-label={`Open ${item.label} tab`}
        >
          <span className="tab-chip-content">
            <span className="tab-icon-badge" aria-hidden>{tabIcons[item.id] ?? "•"}</span>
            <span>{item.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
