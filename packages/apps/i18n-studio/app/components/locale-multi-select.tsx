'use client';

import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';

export interface LocaleOption {
  code: string;
  label: string;
  englishLabel: string;
  nativeLabel: string | null;
}

interface LocaleMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  options: LocaleOption[];
  /** 表单 hidden input 名 */
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 至少选 N 个,达不到时不再允许移除 */
  minSelected?: number;
  className?: string;
  /** 当前用户是否可以管理字典 */
  isSuperuser?: boolean;
}

export function LocaleMultiSelect({
  value,
  onChange,
  options,
  name,
  placeholder = '选择语言',
  disabled,
  minSelected = 0,
  className,
  isSuperuser,
}: LocaleMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const optionByCode = React.useMemo(() => new Map(options.map((o) => [o.code, o])), [options]);
  const selectedItems = value.map(
    (code) => optionByCode.get(code) ?? { code, label: code, englishLabel: code, nativeLabel: null },
  );

  const toggle = (code: string) => {
    if (value.includes(code)) {
      if (value.length <= minSelected) return;
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const remove = (code: string) => {
    if (value.length <= minSelected) return;
    onChange(value.filter((c) => c !== code));
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-auto min-h-9 w-full justify-between gap-1 px-2 py-1.5"
          >
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {selectedItems.length === 0 ? (
                <span className="px-1 text-muted-foreground">{placeholder}</span>
              ) : (
                selectedItems.map((item) => (
                  <Badge key={item.code} variant="secondary" className="gap-1 pr-1 font-mono">
                    {item.code}
                    {value.length > minSelected && !disabled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(item.code);
                        }}
                        className="-mr-0.5 inline-flex size-4 items-center justify-center rounded-sm hover:bg-foreground/10"
                        aria-label={`移除 ${item.code}`}
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </Badge>
                ))
              )}
            </div>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索 (code / 名称)" />
            <CommandList>
              <CommandEmpty>没有匹配的语言</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const checked = value.includes(opt.code);
                  return (
                    <CommandItem
                      key={opt.code}
                      value={`${opt.code} ${opt.label} ${opt.englishLabel} ${opt.nativeLabel ?? ''}`}
                      onSelect={() => toggle(opt.code)}
                    >
                      <span
                        className={cn(
                          'mr-1 grid size-4 shrink-0 place-items-center rounded-sm border',
                          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                        )}
                      >
                        {checked ? <span className="text-[10px] leading-none">✓</span> : null}
                      </span>
                      <span className="font-mono text-xs">{opt.code}</span>
                      <span className="ml-2 text-sm">{opt.label}</span>
                      {opt.nativeLabel && opt.nativeLabel !== opt.label ? (
                        <span className="ml-auto text-xs text-muted-foreground">{opt.nativeLabel}</span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2 text-xs text-muted-foreground">
              {isSuperuser ? (
                <>
                  没有想要的语言?
                  <Link to="/dashboard/locales" className="ml-1 font-medium text-foreground hover:underline">
                    去管理语言库
                  </Link>
                </>
              ) : (
                <>没有想要的语言?请联系系统管理员添加。</>
              )}
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={value.join(',')} /> : null}
    </div>
  );
}
