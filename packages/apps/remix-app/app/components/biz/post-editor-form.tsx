import { useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Tiptap } from '~/components/tiptap/editor';

import {
  tagsAtom,
  postAtom,
  publishPostAtom,
  submittingAtom,
  categoriesAtom,
  ListCategoryAtom,
} from '~/store/blogAtom';
import { useToast } from '~/hooks/use-toast';
import { PostTag } from './post-editor-tag';
import { PostCategory } from './post-editor-category';

import type { Post } from '~/types';

export const PostEditorForm: React.FC<{ defaultContent: string }> = ({ defaultContent }) => {
  const { toast } = useToast();

  const tags = useAtomValue(tagsAtom);
  const post = useAtomValue(postAtom);
  const submitting = useAtomValue(submittingAtom);
  const categories = useAtomValue(categoriesAtom);

  const listCategory = useSetAtom(ListCategoryAtom);
  const savePost = useSetAtom(postAtom);
  const publishPost = useSetAtom(publishPostAtom);

  const { title, content, tags: selectedTags, category } = post;

  const validateForm = () => {
    if (!title.trim()) {
      toast({
        title: '标题不能为空',
        variant: 'destructive',
      });
      return false;
    }

    if (!content.trim()) {
      toast({
        title: '内容不能为空',
        variant: 'destructive',
      });
      return false;
    }

    if (!category) {
      toast({
        title: '分类不能为空',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSave = (values: Partial<Post>) => {
    savePost({
      ...post,
      ...values,
    });
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    publishPost();
  };

  useEffect(() => {
    if (categories.length !== 0) {
      return;
    }

    listCategory();
  }, []);

  return (
    <Card className="mx-auto">
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold">创建新文章</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="space-y-2">
              <Label>内容</Label>
              <Tiptap
                editable={!submitting}
                content={content || defaultContent}
                onChange={(value) => {
                  handleSave({
                    content: value,
                  });
                }}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                placeholder="输入文章标题..."
                value={title}
                onChange={(e) =>
                  handleSave({
                    title: e.target.value,
                  })
                }
              />
            </div>

            <PostCategory
              categories={categories.map((c) => c.name)}
              value={category}
              onChange={(value) => {
                handleSave({
                  category: value,
                });
              }}
            />

            <PostTag
              tags={tags}
              values={selectedTags}
              onValueChange={(values) => {
                handleSave({
                  tags: values,
                });
              }}
            />

            <div className="flex justify-end space-x-2">
              <Button onClick={handlePublish} disabled={submitting}>
                发布文章
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
