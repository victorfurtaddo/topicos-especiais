"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Option = { value: string; label: string; color?: string };

function OptionLabel({ option }: { option: Option }) {
  return (
    <>
      {option.color && <span className="category-dot" aria-hidden style={{ backgroundColor: option.color }} />}
      {option.label}
    </>
  );
}

export function AppSelect({
  id,
  label,
  options,
  ...selection
}: {
  id: string;
  label: string;
  name?: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const { onValueChange, ...props } = selection;
  return (
    <div className="select-field">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={options}
        {...props}
        onValueChange={(value) => {
          if (value !== null) onValueChange?.(value);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {(value: string | null) => {
              const option = options.find((item) => item.value === value);
              return option ? <OptionLabel option={option} /> : null;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <OptionLabel option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
