import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

interface Project {
  name: string;
  desc: string;
  href: string;
}

export const ProjectList: React.FC<{
  projects: Project[];
}> = ({ projects }) => {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {projects.map((project) => (
        <Card key={project.name} className="flex flex-col">
          <CardHeader className="p-4 bg-muted/50">
            <CardTitle>
              <a href={project.href} target="_blank" rel="noopener noreferrer">
                {project.name}
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex-grow">
            <p>{project.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
