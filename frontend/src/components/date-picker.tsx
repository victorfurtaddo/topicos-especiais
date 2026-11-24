"use client";

import { IconCalendar } from "@tabler/icons-react";
import { format, isValid, parseISO } from "date-fns";
import { useId, useState } from "react";
import { ptBR } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

const startMonth = new Date(1900, 0, 1);
const endMonth = new Date(2100, 11, 1);
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

type PickerProps = {
  label: string;
  name?: string;
  precision?: "day" | "month";
  allowClear?: boolean;
} & (
  | { value: string; onChange: (value: string) => void; defaultValue?: never }
  | { value?: never; onChange?: never; defaultValue: string }
);

export function DatePicker({
  label,
  name,
  precision = "day",
  allowClear = false,
  ...selection
}: PickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState(selection.defaultValue ?? "");
  const [month, setMonth] = useState<Date>();
  const value = selection.value ?? stored;
  const parsed = parseISO(value);
  const selected = isValid(parsed) ? parsed : undefined;
  const isMonth = precision === "month";

  function commit(date?: Date) {
    const next = date ? format(date, isMonth ? "yyyy-MM" : "yyyy-MM-dd") : "";
    if (selection.onChange) selection.onChange(next);
    else setStored(next);
    setOpen(false);
  }

  return (
    <div className="date-field">
      <Label htmlFor={id}>{label}</Label>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={(next) => {
        if (next) setMonth(selected);
        setOpen(next);
      }}>
        <PopoverTrigger render={
          <Button id={id} type="button" variant="outline" size="lg" className="date-trigger">
            <IconCalendar aria-hidden />
            {selected
              ? isMonth ? monthLabel.format(selected) : format(selected, "dd/MM/yyyy")
              : "Selecionar data"}
          </Button>
        } />
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-24px)]">
          <PopoverTitle className="sr-only">{label}</PopoverTitle>
          <Calendar
            mode="single"
            locale={ptBR}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            selected={isMonth ? undefined : selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={isMonth ? undefined : (date) => { if (date) commit(date); }}
            required
            showOutsideDays={false}
            classNames={isMonth ? { month_grid: "hidden" } : undefined}
          />
          {isMonth && (
            <Button type="button" onClick={() => commit(month ?? selected ?? new Date())}>
              Selecionar mês
            </Button>
          )}
          {allowClear && value && (
            <Button type="button" variant="ghost" onClick={() => commit()}>Limpar data</Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
