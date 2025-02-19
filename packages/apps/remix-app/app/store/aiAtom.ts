import { atom } from 'jotai';
import { Message } from '~/types';

const defaultMessages: Message[] = [
  {
    role: 'ai',
    content: 'Hello, how can I help you today?',
  },
  {
    role: 'user',
    content: 'I need help with my account.',
  },
];

export const messagesAtom = atom<Message[]>(defaultMessages);

export const sendMessageAtom = atom(null, (_get, set, message: string) => {
  const messages = _get(messagesAtom);
  set(messagesAtom, [
    ...messages,
    {
      role: 'user',
      content: message,
    },
  ]);
});
