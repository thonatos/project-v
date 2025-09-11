import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAtomValue, useSetAtom } from 'jotai';

import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Tiptap } from '~/components/tiptap/editor';

import {
  tagsAtom,
  postAtom,
  submittingAtom,
  resetPostAtom,
  publishPostAtom,
  categoriesAtom,
  listCategoryAtom,
} from '~/store/blogAtom';

import { PostEditorTag } from './post-editor-tag';
import { PostEditorCategory } from './post-editor-category';

import type { Post } from '~/types';

export const PostEditorForm: React.FC<{
  id?: string;
  defaultContent?: string;
}> = ({ id, defaultContent }) => {
  const tags = useAtomValue(tagsAtom);
  const post = useAtomValue(postAtom);
  const submitting = useAtomValue(submittingAtom);
  const categories = useAtomValue(categoriesAtom);

  const navigate = useNavigate();
  const savePost = useSetAtom(postAtom);
  const resetPost = useSetAtom(resetPostAtom);
  const publishPost = useSetAtom(publishPostAtom);
  const listCategory = useSetAtom(listCategoryAtom);

  const { title, content, excerpt, tags: selectedTags, category_name } = post;

  const validateForm = () => {
    if (!title.trim()) {
      toast.warning('标题不能为空');
      return false;
    }

    if (!content.trim()) {
      toast.warning('内容不能为空');
      return false;
    }

    if (!category_name) {
      toast.warning('分类不能为空');
      return false;
    }

    return true;
  };

  const handleReset = () => {
    if (submitting) {
      return;
    }

    resetPost();
    navigate('/');
  };

  const handleSave = (values: Partial<Post>) => {
    savePost({
      ...post,
      ...values,
    });
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    const res = await publishPost();

    if (res?.data) {
      toast('发布成功, 正在跳转...');

      setTimeout(() => {
        resetPost();
        navigate(`/post/${res.data.id}`);
      }, 2000);
      return;
    }

    if (res?.error) {
      toast.warning('发布失败');
    }
  };

  useEffect(() => {
    if (categories.length !== 0) {
      return;
    }

    listCategory();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 space-y-6">
      {/* content */}
      <div className="col-span-3">
        <div className="space-y-2">
          {/* <Label>内容</Label> */}
          <Tiptap
            editable={true}
            content={content || defaultContent}
            onChange={(value) => {
              handleSave({
                content: value,
              });
            }}
          />
        </div>
      </div>

      {/* controls */}
      <Card className="p-4">
        {id && (
          <div className="space-y-2">
            <Label htmlFor="id">ID</Label>
            <Input id="id" value={id} readOnly disabled />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="输入文章标题..."
            value={title}
            required
            onChange={(e) =>
              handleSave({
                title: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea
            id="excerpt"
            placeholder="输入文章摘要..."
            value={excerpt}
            onChange={(e) =>
              handleSave({
                excerpt: e.target.value,
              })
            }
          />
        </div>

        <PostEditorCategory
          categories={categories.map((c) => c.name)}
          value={category_name}
          onChange={(value) => {
            handleSave({
              category_name: value,
            });
          }}
        />

        <PostEditorTag
          tags={tags}
          values={selectedTags}
          onValueChange={(values) => {
            handleSave({
              tags: values,
            });
          }}
        />

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleReset} disabled={submitting}>
            取消
          </Button>

          <Button onClick={handlePublish} disabled={submitting}>
            发布
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PostEditorForm;
