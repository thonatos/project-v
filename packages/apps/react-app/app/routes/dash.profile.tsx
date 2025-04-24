import { Suspense } from 'react';
import { Await, Link } from 'react-router';
import { useAtomValue } from 'jotai';

import { ProfileForm } from '~/components/biz/profile-form';
import { profileAtom } from '~/store/authAtom';

import type { Route } from './+types/dash.profile';

export const handle = {
  breadcrumb: () => <Link to="/auth/profile">Profile</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Profile' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export default function ({}: Route.ComponentProps) {
  const profile = useAtomValue(profileAtom);

  return (
    <div className="max-w-full">
      <div className="space-y-4">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={profile}>
            <ProfileForm profile={profile as any} />
          </Await>
        </Suspense>
      </div>
    </div>
  );
}
