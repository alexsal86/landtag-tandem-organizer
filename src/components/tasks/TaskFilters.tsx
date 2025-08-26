import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILTER_OPTIONS, CATEGORY_FILTER_OPTIONS, PRIORITY_FILTER_OPTIONS } from "@/constants/taskConstants";

interface TaskFiltersProps {
  filter: string;
  setFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
}

export function TaskFilters({
  filter,
  setFilter,
  categoryFilter,
  setCategoryFilter,
  priorityFilter,
  setPriorityFilter
}: TaskFiltersProps) {
  return (
    <div className="flex gap-4 mb-6">
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Status filtern" />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Kategorie filtern" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_FILTER_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Priorität filtern" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_FILTER_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}