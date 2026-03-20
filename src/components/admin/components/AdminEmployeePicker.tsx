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
    <div className="flex flex-wrap gap-2">
      {employees.map((employee) => {
        const isSelected = selectedUserId === employee.user_id;

        return (
          <Button
            key={employee.user_id}
            variant={isSelected ? "default" : "outline"}
            className="h-auto px-3 py-2"
            onClick={() => onSelectEmployee(employee.user_id)}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={employee.avatar_url || undefined}
                  alt={employee.display_name || "Mitarbeiter"}
                />
                <AvatarFallback className="text-[10px]">
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
