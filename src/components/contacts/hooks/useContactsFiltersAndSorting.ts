import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { debounce } from "@/utils/debounce";

export type ContactsSortDirection = "asc" | "desc";

export interface UseContactsFiltersAndSortingResult {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  debouncedSearchTerm: string;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedType: string;
  setSelectedType: Dispatch<SetStateAction<string>>;
  selectedTagFilter: string;
  setSelectedTagFilter: Dispatch<SetStateAction<string>>;
  sortColumn: string | null;
  sortDirection: ContactsSortDirection;
  stakeholderSortColumn: string | null;
  stakeholderSortDirection: ContactsSortDirection;
  activeSortColumn: string | null;
  activeSortDirection: ContactsSortDirection;
  handleSort: (column: string) => void;
  handleStakeholderSort: (column: string) => void;
}

export function useContactsFiltersAndSorting(activeTab: string): UseContactsFiltersAndSortingResult {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<ContactsSortDirection>("asc");
  const [stakeholderSortColumn, setStakeholderSortColumn] = useState<string | null>(null);
  const [stakeholderSortDirection, setStakeholderSortDirection] = useState<ContactsSortDirection>("asc");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");

  const debouncedUpdate = useMemo(() => debounce((term: string) => setDebouncedSearchTerm(term), 300), []);

  useEffect(() => {
    debouncedUpdate(searchTerm);
  }, [searchTerm, debouncedUpdate]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  };

  const handleStakeholderSort = (column: string) => {
    if (stakeholderSortColumn === column) {
      setStakeholderSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setStakeholderSortColumn(column);
    setStakeholderSortDirection("asc");
  };

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    selectedTagFilter,
    setSelectedTagFilter,
    sortColumn,
    sortDirection,
    stakeholderSortColumn,
    stakeholderSortDirection,
    activeSortColumn: activeTab === "stakeholders" ? stakeholderSortColumn : sortColumn,
    activeSortDirection: activeTab === "stakeholders" ? stakeholderSortDirection : sortDirection,
    handleSort,
    handleStakeholderSort,
  };
}
