import { atom } from 'jotai';
import { chat } from './service/worker';
import { Message } from '~/types';

const defaultMessages: Message[] = [
  {
    role: 'system',
    content: 'You are a friendly assistant.',
  },
];

export const messagesAtom = atom<Message[]>(defaultMessages);

export const sendMessageAtom = atom(null, async (get, set, message: string, token: string) => {
  const messages = get(messagesAtom);

  const newMessages = [
    ...messages,
    {
      role: 'user',
      content: message,
    },
  ];

  set(messagesAtom, newMessages);

  let newMessage = '';

  await chat(
    {
      messages: newMessages,
    },
    {
      token,
      onMessage: (data) => {
        try {
          const jsonData = JSON.parse(data);
          const content = jsonData.response;
          newMessage += content;
          set(messagesAtom, [
            ...newMessages,
            {
              role: 'system',
              content: newMessage,
            },
          ]);
        } catch (error) {}
      },
    }
  );
});
