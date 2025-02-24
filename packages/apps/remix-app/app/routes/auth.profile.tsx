import { Suspense } from 'react';
import { Await, Link } from '@remix-run/react';
import { useAtomValue } from 'jotai';

import { ProfileForm } from '~/components/biz/profile-form';
import { profileAtom } from '~/store/authAtom';
import type { MetaFunction } from '@vercel/remix';

export const handle = {
  breadcrumb: () => <Link to="/auth/profile">Profile</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Profile' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const AuthProfilePage: React.FC<{}> = () => {
  const profile = useAtomValue(profileAtom);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="md:col-span-2">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={profile}>
            <ProfileForm profile={profile as any} />
          </Await>
        </Suspense>
      </div>
    </div>
  );
};

export default AuthProfilePage;
