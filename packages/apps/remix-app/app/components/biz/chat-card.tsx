import React, { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { Message } from '~/types';

export const ChatCard: React.FC<{
  isOpen?: boolean;
  messages: Message[];
  onSendMessage: (message: string) => void;
}> = ({ isOpen = false, messages, onSendMessage }) => {
  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    onSendMessage(input);
    setInput('');
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
        hidden: !isOpen,
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
            <p className="text-sm text-muted-foreground">worker@cloudflare.com</p>
          </div>
        </div>
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
