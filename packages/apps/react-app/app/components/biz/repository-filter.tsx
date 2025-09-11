import React, { useCallback, useEffect, useState, useTransition, useMemo } from 'react';
import { useAtom } from 'jotai';
import { loadRepoAtom, filterRepoAtom } from '~/store/githubAtom';

import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { debounce } from '~/lib/utils';

export function RepositoryFilter() {
  const [filterName, setFilterName] = useState('');
  const [{ languages = [] }] = useAtom(loadRepoAtom);
  const [{ lang }, dispach] = useAtom(filterRepoAtom);
  const [isPending, startTransition] = useTransition();

  const updateFilterName = (value: string) => {
    setFilterName(value);
    startTransition(() => {
      debouncedSearch(value);
    });
  };

  const updateFilterLang = (value: string) => {
    dispach({
      lang: value === 'all' ? '' : value,
    });
  };

  // debounce 只包裹 dispach，避免频繁触发
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      dispach({
        name: value && value.trim().toLowerCase(),
      });
    }, 200),
    []
  );

  // memoize language options，防止不必要的渲染
  const languageOptions = useMemo(
    () => [
      <SelectItem key="all" value="all" data-slot="lang-option-all">
        All
      </SelectItem>,
      ...languages.map(({ name, value }) => (
        <SelectItem key={name} value={name} data-slot="lang-option">
          {name}({value})
        </SelectItem>
      )),
    ],
    [languages]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Input
        type="text"
        placeholder="Search repositories..."
        className="flex-grow"
        value={filterName}
        onChange={(e) => updateFilterName(e.target.value)}
        data-slot="repo-filter-input"
      />

      <Select value={lang} onValueChange={updateFilterLang}>
        <SelectTrigger className="w-full sm:w-[180px]" data-slot="lang-select-trigger">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>{languageOptions}</SelectContent>
      </Select>
      {isPending && (
        <div className="ml-2 text-xs text-gray-400 self-center" data-slot="repo-filter-loading">
          Loading...
        </div>
      )}
    </div>
  );
}

export default RepositoryFilter;
