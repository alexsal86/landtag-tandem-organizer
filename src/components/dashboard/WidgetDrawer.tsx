import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CallLogWidget } from "@/components/widgets/CallLogWidget";
import { PomodoroWidget } from "@/components/widgets/PomodoroWidget";
import { QuickNotesWidget } from "@/components/widgets/QuickNotesWidget";

interface WidgetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeWidget: 'calllog' | 'pomodoro' | 'quicknotes' | null;
}

export function WidgetDrawer({ isOpen, onClose, activeWidget }: WidgetDrawerProps) {
  const getWidgetTitle = () => {
    switch (activeWidget) {
      case 'calllog':
        return 'Call Log';
      case 'pomodoro':
        return 'Pomodoro Timer';
      case 'quicknotes':
        return 'Quick Notes';
      default:
        return '';
    }
  };

  const renderWidget = () => {
    switch (activeWidget) {
      case 'calllog':
        return <CallLogWidget />;
      case 'pomodoro':
        return <PomodoroWidget />;
      case 'quicknotes':
        return <QuickNotesWidget />;
      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[500px] p-6 overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold">{getWidgetTitle()}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {renderWidget()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
