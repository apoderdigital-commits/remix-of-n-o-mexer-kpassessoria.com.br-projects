import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format, subDays } from "date-fns";

interface DateFilterProps {
  onFilterChange: (since: string, until: string) => void;
}

export function DateFilter({ onFilterChange }: DateFilterProps) {
  const [active, setActive] = useState("30d");

  const presets = [
    { label: "7d", days: 7 },
    { label: "15d", days: 15 },
    { label: "30d", days: 30 },
    { label: "60d", days: 60 },
    { label: "90d", days: 90 },
  ];

  const handlePreset = (label: string, days: number) => {
    setActive(label);
    const until = format(new Date(), "yyyy-MM-dd");
    const since = format(subDays(new Date(), days), "yyyy-MM-dd");
    onFilterChange(since, until);
  };

  return (
    <div className="flex gap-1">
      {presets.map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant={active === p.label ? "default" : "ghost"}
          onClick={() => handlePreset(p.label, p.days)}
          className="text-xs h-8 px-3"
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
