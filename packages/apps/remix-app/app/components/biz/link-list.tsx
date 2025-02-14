import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export const LinkList: React.FC<{
  projects: Project[];
}> = ({ projects }) => {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => (
        <Card key={project.name} className="flex flex-col">
          <CardHeader className="bg-muted/50">
            <CardTitle>
              <a href={project.href} target="_blank" rel="noopener noreferrer">
                {project.name}
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="pt-2">{project.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface Project {
  name: string;
  desc: string;
  href: string;
}
