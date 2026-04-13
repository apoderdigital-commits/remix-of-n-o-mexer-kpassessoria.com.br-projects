import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DateFilterProps {
  onFilterChange: (since: string, until: string) => void;
}

export function DateFilter({ onFilterChange }: DateFilterProps) {
  const [active, setActive] = useState("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [mode, setMode] = useState<"range" | "single">("range");

  const presets = [
    { label: "7d", days: 7 },
    { label: "15d", days: 15 },
    { label: "60d", days: 60 },
  ];

  const handlePreset = (label: string, days: number) => {
    setActive(label);
    setDateRange(undefined);
    setSingleDate(undefined);
    const until = format(new Date(), "yyyy-MM-dd");
    const since = format(subDays(new Date(), days), "yyyy-MM-dd");
    onFilterChange(since, until);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setActive("custom");
      const since = format(range.from, "yyyy-MM-dd");
      const until = format(range.to, "yyyy-MM-dd");
      onFilterChange(since, until);
    }
  };

  const handleSingleSelect = (date: Date | undefined) => {
    setSingleDate(date);
    if (date) {
      setActive("single");
      const d = format(date, "yyyy-MM-dd");
      onFilterChange(d, d);
    }
  };

  const getCustomLabel = () => {
    if (active === "single" && singleDate) {
      return format(singleDate, "dd/MM/yyyy");
    }
    if (active === "custom" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`;
    }
    return null;
  };

  const customLabel = getCustomLabel();

  return (
    <div className="flex items-center gap-1">
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={active === "custom" || active === "single" ? "default" : "outline"}
            className={cn("text-xs h-8 gap-1.5 px-3", customLabel && "min-w-[140px]")}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {customLabel || "Período"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card border-border/50" align="end">
          <div className="flex border-b border-border/30">
            <Button
              size="sm"
              variant={mode === "range" ? "default" : "ghost"}
              onClick={() => setMode("range")}
              className="rounded-none text-xs flex-1"
            >
              Período
            </Button>
            <Button
              size="sm"
              variant={mode === "single" ? "default" : "ghost"}
              onClick={() => setMode("single")}
              className="rounded-none text-xs flex-1"
            >
              Dia específico
            </Button>
          </div>

          {mode === "range" ? (
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              locale={ptBR}
              disabled={(date) => date > new Date()}
              className={cn("p-3 pointer-events-auto")}
            />
          ) : (
            <Calendar
              mode="single"
              selected={singleDate}
              onSelect={handleSingleSelect}
              locale={ptBR}
              disabled={(date) => date > new Date()}
              className={cn("p-3 pointer-events-auto")}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
