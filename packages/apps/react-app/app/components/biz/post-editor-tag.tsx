import { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';

import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';

interface PostEditorTagProps {
  tags: string[];
  values: string[];
  onValueChange: (tags: string[]) => void;
}

export const PostEditorTag: React.FC<PostEditorTagProps> = ({ tags, values, onValueChange }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSelect = (tag: string) => {
    if (!values.includes(tag)) {
      onValueChange([...values, tag]);
    }
    setOpen(false);
    setInputValue('');
  };

  const handleCreateTag = () => {
    if (inputValue && !values.includes(inputValue)) {
      onValueChange([...values, inputValue]);
      setInputValue('');
      setOpen(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onValueChange(values.filter((tag) => tag !== tagToRemove));
  };

  const availableTags = tags.filter((tag) => !values.includes(tag));

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((tag) => (
          <Badge key={tag} variant="secondary" className="px-3 py-1">
            {tag}
            <button onClick={() => removeTag(tag)} className="ml-2 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            添加文章标签...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索标签..." value={inputValue} onValueChange={setInputValue} />
            <CommandList>
              <CommandEmpty className="py-2 px-4">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleCreateTag}>
                  <PlusCircle className="h-4 w-4" />
                  创建 "{inputValue}"
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {availableTags.map((tag) => (
                  <CommandItem key={tag} value={tag} onSelect={() => handleSelect(tag)}>
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
