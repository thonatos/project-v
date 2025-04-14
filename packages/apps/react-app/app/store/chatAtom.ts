import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { chatText } from '~/service/chat';

export interface Message {
  role: string;
  content: string;
}

const defaultMessages: Message[] = [
  {
    role: 'system',
    content: 'You are a friendly assistant.',
  },
];

export const messagesAtom = atomWithStorage<Message[]>('remix_worker_messages', defaultMessages, undefined, {
  getOnInit: true,
});

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

  await chatText(
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

export const clearMessagesAtom = atom(null, (_get, set) => {
  set(messagesAtom, defaultMessages);
});
