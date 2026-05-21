"use client";
import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex items-baseline gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
              ${isActive
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-background border border-border text-muted"}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
