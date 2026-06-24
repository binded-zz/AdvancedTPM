import { useState, useCallback } from 'react';

export type SortDir = 'asc' | 'desc';

export interface UseTableSortResult<T> {
  sortField: T;
  sortDir: SortDir;
  handleSort: (field: T, isNumeric?: boolean) => void;
  sortIndicator: (field: T) => string;
}

export function useTableSort<T>(
  initialField: T,
  initialDir: SortDir = 'asc',
  ascIndicator: string = ' ▲',
  descIndicator: string = ' ▼'
): UseTableSortResult<T> {
  const [sortField, setSortField] = useState<T>(initialField);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const handleSort = useCallback((field: T, isNumeric: boolean = false) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(isNumeric ? 'desc' : 'asc');
    }
  }, [sortField]);

  const sortIndicator = useCallback((field: T) => {
    return sortField === field ? (sortDir === 'asc' ? ascIndicator : descIndicator) : '';
  }, [sortField, sortDir, ascIndicator, descIndicator]);

  return {
    sortField,
    sortDir,
    handleSort,
    sortIndicator,
  };
}
