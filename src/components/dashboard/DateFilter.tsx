import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { format, subDays, isSameDay } from "date-fns";
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
  // Tracks how many clicks have happened in the current selection cycle.
  // 0 = nothing selected yet, 1 = waiting for end date, 2 = full range selected
  const [clickStage, setClickStage] = useState<0 | 1 | 2>(0);

  const presets = [
    { label: "7d", days: 7 },
    { label: "15d", days: 15 },
    { label: "60d", days: 60 },
  ];

  const handlePreset = (label: string, days: number) => {
    setActive(label);
    setDateRange(undefined);
    setClickStage(0);
    const until = format(new Date(), "yyyy-MM-dd");
    const since = format(subDays(new Date(), days), "yyyy-MM-dd");
    onFilterChange(since, until);
  };

  const applyRange = (from: Date, to: Date) => {
    const since = format(from, "yyyy-MM-dd");
    const until = format(to, "yyyy-MM-dd");
    onFilterChange(since, until);
  };

  // Custom click handler: we use mode="single" semantics manually so we can
  // implement: 1st click = start, 2nd click = end (or single day if same), 3rd click = reset
  const handleDayClick = (day: Date) => {
    if (clickStage === 0 || clickStage === 2) {
      // Start a new selection
      setDateRange({ from: day, to: undefined });
      setClickStage(1);
      setActive("custom");
      // Don't fire filter yet — wait for the second click (or single-day double click)
      // But fire single-day filter so user sees feedback if they stop here? No, wait.
    } else if (clickStage === 1) {
      const start = dateRange?.from;
      if (!start) {
        setDateRange({ from: day, to: undefined });
        setClickStage(1);
        return;
      }
      // Same day clicked twice → single day filter
      if (isSameDay(start, day)) {
        setDateRange({ from: day, to: day });
        setClickStage(2);
        setActive("single");
        applyRange(day, day);
        return;
      }
      // Order start/end correctly
      const from = day < start ? day : start;
      const to = day < start ? start : day;
      setDateRange({ from, to });
      setClickStage(2);
      setActive("custom");
      applyRange(from, to);
    }
  };

  const getCustomLabel = () => {
    if (active === "single" && dateRange?.from) {
      return format(dateRange.from, "dd/MM/yyyy");
    }
    if (active === "custom" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`;
    }
    if (active === "custom" && dateRange?.from && !dateRange?.to) {
      return `${format(dateRange.from, "dd/MM")} - ...`;
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
          <div className="px-3 pt-3 pb-2 text-xs text-muted-foreground border-b border-border/30">
            {clickStage === 0 && "Clique no dia inicial do período"}
            {clickStage === 1 && "Clique no dia final (ou no mesmo dia para filtrar 1 dia)"}
            {clickStage === 2 && "Clique novamente para iniciar uma nova seleção"}
          </div>
          <Calendar
            mode="range"
            selected={dateRange}
            onDayClick={handleDayClick}
            numberOfMonths={2}
            locale={ptBR}
            disabled={(date) => date > new Date()}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
