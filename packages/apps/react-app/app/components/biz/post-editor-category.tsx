import React from 'react';

import { Label } from '~/components/ui/label';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '~/components/ui/select';

interface PostEditorCategoryProps {
  value?: string;
  categories: string[];
  onChange: (category: string) => void;
}

export const PostEditorCategory: React.FC<PostEditorCategoryProps> = ({ categories, value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label>Category</Label>
      <Select value={value} onValueChange={onChange} required>
        <SelectTrigger>
          <SelectValue placeholder="选择文章分类..." />
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
};

export default PostEditorCategory;
