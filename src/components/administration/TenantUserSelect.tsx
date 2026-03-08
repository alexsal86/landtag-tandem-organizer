import React, { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTenantUsers, type TenantUser } from "@/hooks/useTenantUsers";

interface TenantUserSelectProps {
  value: string;
  onValueChange: (userId: string) => void;
  placeholder?: string;
  label?: string;
}

export const TenantUserSelect: React.FC<TenantUserSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Nutzer:in auswählen…",
}) => {
  const { users, loading } = useTenantUsers();
  const [open, setOpen] = useState(false);

  const selected = users.find((u) => u.id === value);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selected.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(selected.display_name)}
                </AvatarFallback>
              </Avatar>
              {selected.display_name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Suchen…" />
          <CommandList>
            <CommandEmpty>Keine Nutzer:innen gefunden.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.display_name}
                  onSelect={() => {
                    onValueChange(user.id);
                    setOpen(false);
                  }}
                >
                  <Avatar className="mr-2 h-6 w-6">
                    <AvatarImage src={user.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(user.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{user.display_name}</span>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
