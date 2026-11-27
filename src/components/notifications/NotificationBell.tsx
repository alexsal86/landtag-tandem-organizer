import { useState } from 'react';
import type { JSX } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '@/contexts/NotificationContext';

export const NotificationBell = ({ variant = "default" }: { variant?: "default" | "island" }): JSX.Element => {
  const [open, setOpen] = useState<boolean>(false);
  const { unreadCount } = useNotifications();
  const isIsland = variant === "island";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isIsland ? "outline" : "ghost"}
          size="sm"
          className={isIsland
            ? "relative size-11 rounded-full border-border/80 bg-card/90 p-0 text-muted-foreground shadow-sm hover:border-[#2e6018] hover:bg-card/90 hover:text-muted-foreground"
            : "relative size-8 p-0"}
          aria-label={`Benachrichtigungen${unreadCount > 0 ? ` (${unreadCount} ungelesen)` : ''}`}
        >
          {!isIsland && unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {unreadCount > 0 && (isIsland
            ? open
              ? <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-[#2e6018] px-1 text-[10px] font-semibold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>
              : <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-[#2e6018] dark:bg-[#83c84e]" />
            : (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center p-0 text-[10px]"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              ))}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-1rem)] p-0" align="end" sideOffset={5}>
        <NotificationCenter greenUnreadBadge={isIsland} onClose={(): void => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
