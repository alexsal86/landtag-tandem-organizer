import { mentionColors } from "@/utils/mentionColors";
import { getHashedColor } from "@/utils/userColors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "../utils/timeFormatting";
import type { Employee } from "../types";

interface AdminEmployeePickerProps {
  employees: Employee[];
  selectedUserId: string;
  onSelectEmployee: (userId: string) => void;
}

export function AdminEmployeePicker({
  employees,
  selectedUserId,
  onSelectEmployee,
}: AdminEmployeePickerProps) {
  return (
    <div role="group" aria-label="Mitarbeiter auswählen" className="flex flex-wrap gap-2">
      {employees.map((employee) => {
        const color = mentionColors(employee.badge_color || getHashedColor(employee.user_id));
        const isSelected = selectedUserId === employee.user_id;

        return (
          <Button
            key={employee.user_id}
            variant="outline"
            aria-pressed={isSelected}
            className={`h-auto rounded-full py-1 pl-1 pr-3 ${isSelected ? "border-lime-600 bg-lime-50 text-foreground hover:bg-lime-100 dark:bg-lime-950/40" : ""}`}
            onClick={() => onSelectEmployee(employee.user_id)}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={employee.avatar_url || undefined}
                  alt={employee.display_name || "Mitarbeiter"}
                />
                <AvatarFallback className="text-[10px] font-semibold" style={{ backgroundColor: color.background, color: color.text }}>
                  {getInitials(employee.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{employee.display_name}</span>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
