import React, { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Send, TrashIcon } from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';

import { tokenAtom } from '~/store/authAtom';
import { clearMessagesAtom, messagesAtom, sendMessageAtom } from '~/store/workerAtom';

export const ChatCard: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = useAtomValue(tokenAtom);
  const messages = useAtomValue(messagesAtom);
  const sendMessage = useSetAtom(sendMessageAtom);
  const clearMessages = useSetAtom(clearMessagesAtom);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (input.length === 0) {
      return;
    }

    sendMessage(input, token || '');
    setInput('');
  };

  const handleClearMessages = () => {
    clearMessages();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn('h-full flex flex-col', {
        hidden: disabled,
      })}
    >
      {/* Header */}
      <div className="p-2 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Avatar>
            <AvatarImage src="https://picsum.photos/id/89/96/96" alt="Image" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium leading-none">AI Assistant</p>
            <p className="text-sm text-muted-foreground">Powered by CF Workers AI</p>
          </div>
        </div>

        <Button size="icon" disabled={messages.length === 1} onClick={handleClearMessages}>
          <TrashIcon />
          <span className="sr-only">Clear</span>
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';

            return (
              <div
                key={index}
                className={cn('flex items-start space-x-2', {
                  'flex-row-reverse space-x-reverse': isUser,
                })}
              >
                <div
                  className={cn('rounded-lg p-2 max-w-[70%]', {
                    'bg-primary text-primary-foreground': isUser,
                    'bg-muted': !isUser,
                  })}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button onClick={handleSendMessage} size="icon" disabled={input.length === 0}>
            <Send />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};
