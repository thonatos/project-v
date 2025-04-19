import React from 'react';
import { REMIX_WEB } from '~/constants';
import { Logo } from '~/components/biz/logo';
import { Card, CardContent, CardHeader } from '~/components/ui/card';

export const OpenGraph: React.FC<{
  title?: string;
  description?: string;
}> = (options) => {
  const title = options.title || REMIX_WEB.base.name;
  const description = options.description || REMIX_WEB.base.description;

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <div className="flex justify-end">
          <Logo
            title={REMIX_WEB.base.name}
            description={REMIX_WEB.base.description}
            className="bg-slate-200 rounded-sm"
          />
        </div>
        <h2 className="text-sm md:text-xl font-bold">{title}</h2>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-xs text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
};
