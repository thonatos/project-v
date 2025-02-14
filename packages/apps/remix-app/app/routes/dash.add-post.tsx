import React, { Suspense } from 'react';
import { Link } from '@remix-run/react';
import { PostEditorForm } from '~/components/biz/post-editor-form';

import type { MetaFunction } from '@vercel/remix';

export const handle = {
  breadcrumb: () => <Link to="/dash/add-post">Add Post</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Tiptap' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

const content = `
<h2>
  Hi there,
</h2>
<p>
  this is a basic <em>basic</em> example of <strong>Tiptap</strong>. Sure, there are all kind of basic text styles you’d probably expect from a text editor. But wait until you see the lists:
</p>
<ul>
  <li>
    That’s a bullet list with one …
  </li>
  <li>
    … or two list items.
  </li>
</ul>
<p>
  Isn’t that great? And all of that is editable. But wait, there’s more. Let’s try a code block:
</p>
<pre><code class="language-css">body { display: none; }</code></pre>
<p>
  I know, I know, this is impressive. It’s only the tip of the iceberg though. Give it a try and click a little bit around. Don’t forget to check the other examples too.
</p>
<blockquote>
  Wow, that’s amazing. Good work, boy! 👏
  <br />
  — Mom
</blockquote>
`;

export const PostNewPage: React.FC<{}> = () => {
  return (
    <div className="max-w-full overflow-hidden">
      <Suspense fallback={<div>loading</div>}>
        <PostEditorForm defaultContent={content} />
      </Suspense>
    </div>
  );
};

export default PostNewPage;
