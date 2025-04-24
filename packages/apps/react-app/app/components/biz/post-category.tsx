import React from 'react';

import { Button } from '~/components/ui/button';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '~/components/ui/select';
import { useIsMobile } from '~/hooks/use-mobile';

interface CategoryProps {
  value?: string;
  categories: string[];
  onChange: (category: string) => void;
}

export const PostCategory: React.FC<CategoryProps> = ({ categories, value, onChange }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        <Select value={value} onValueChange={onChange} required>
          <SelectTrigger>
            <SelectValue placeholder="选择分类..." />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-x-2">
      {categories.map((category) => (
        <Button
          key={category}
          size={'sm'}
          variant={value === category ? 'default' : 'outline'}
          className="text-sm"
          onClick={() => {
            onChange(category);
          }}
        >
          {category}
        </Button>
      ))}
    </div>
  );
};

export default PostCategory;
