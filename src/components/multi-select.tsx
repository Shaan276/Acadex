"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
}: {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = React.useState("");

  if (options.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-xl border border-border/50 text-center">
        {placeholder}
      </div>
    );
  }

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelectAll = () => {
    const allFilteredValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...selected, ...allFilteredValues]));
    onChange(combined);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleRemoveOne = (valToRemove: string) => {
    onChange(selected.filter((v) => v !== valToRemove));
  };

  // Find labels for selected chips
  const selectedItemsWithLabels = selected
    .map((val) => {
      const found = options.find((o) => o.value === val);
      return { value: val, label: found ? found.label : val };
    });

  return (
    <div className="space-y-2 border border-border rounded-xl p-2.5 bg-card">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search options..."
            className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          <span className="text-[11px] text-muted-foreground font-medium">
            {selected.length} of {options.length} selected
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={selected.length === 0}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Selected tags preview */}
      {selectedItemsWithLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1 bg-muted/20 rounded-lg">
          {selectedItemsWithLabels.map((item) => (
            <Badge
              key={item.value}
              variant="secondary"
              className="text-[11px] px-2 py-0.5 gap-1 rounded-md bg-primary/10 text-primary border-primary/20"
            >
              <span className="truncate max-w-[120px]">{item.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveOne(item.value)}
                className="hover:opacity-75 focus:outline-none"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Scrollable Checkbox Grid */}
      {filteredOptions.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No matches found for &quot;{search}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1">
          {filteredOptions.map((option) => {
            const isChecked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={`relative flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                  isChecked
                    ? "bg-primary/10 border-primary/40 text-primary font-medium"
                    : "bg-background border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  className="absolute opacity-0 w-0 h-0"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, option.value]);
                    } else {
                      onChange(selected.filter((val) => val !== option.value));
                    }
                  }}
                />
                <div
                  className={`h-3.5 w-3.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${
                    isChecked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                </div>
                <span className="text-xs truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
