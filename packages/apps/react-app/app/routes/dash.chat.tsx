import { Link } from 'react-router';
import { ChatCard } from '~/components/biz/chat-card';
import { useAtomValue } from 'jotai';
import { profileAtom } from '~/store/authAtom';
import type { Route } from './+types/dash.chat';

export const handle = {
  breadcrumb: () => <Link to="/chat">Chat</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Chat' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export default function ({}: Route.ComponentProps) {
  const profile = useAtomValue(profileAtom);

  return (
    <div className="max-w-full">
      <ChatCard disabled={!profile} />
    </div>
  );
}
