import React from 'react';
import { OSS_PROJECTS } from '~/constants';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export const ProjectList: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {OSS_PROJECTS.map((project) => (
        <Card key={project.name} className="flex flex-col py-0 gap-0">
          <CardHeader className="p-4 bg-muted/50">
            <CardTitle>
              <a href={project.href} target="_blank" rel="noopener noreferrer">
                {project.name}
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <p className="text-sm text-muted-foreground">{project.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
