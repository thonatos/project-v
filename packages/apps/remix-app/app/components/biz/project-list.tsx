import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

export const ProjectList: React.FC<{
  projects: Project[];
}> = ({ projects }) => {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <Card key={project.name} className="flex flex-col">
          <CardHeader>
            <CardTitle>
              <a href={project.href} target="_blank" rel="noopener noreferrer">
                {project.name}
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <CardDescription>{project.desc}</CardDescription>
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
