import React, { useCallback, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { loadRepoAtom, filterRepoAtom } from '~/store/githubAtom';

import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { debounce } from '~/lib/utils';

export const RepositoryFilter: React.FC<{}> = () => {
  const [filterName, setFilterName] = useState('');
  const [{ languages = [] }] = useAtom(loadRepoAtom);
  const [{ lang }, dispach] = useAtom(filterRepoAtom);

  const updateFilterName = (value: string) => {
    setFilterName(value);
  };

  const updateFilterLang = (value: string) => {
    dispach({
      lang: value === 'all' ? '' : value,
    });
  };

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      dispach({
        name: value && value.trim().toLowerCase(),
      });
    }, 200),
    []
  );

  useEffect(() => {
    debouncedSearch(filterName);
  }, [filterName, debouncedSearch]);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Input
        type="text"
        placeholder="Search repositories..."
        className="flex-grow"
        value={filterName}
        onChange={(e) => updateFilterName(e.target.value)}
      />

      <Select value={lang} onValueChange={updateFilterLang}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem key="all" value="all">
            All
          </SelectItem>
          {languages.map(({ name, value }) => (
            <SelectItem key={name} value={name}>
              {name}({value})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default RepositoryFilter;
