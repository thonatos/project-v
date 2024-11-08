import React from 'react';
import { Link } from '@remix-run/react';
import { Star, GitFork, Eye, CircleDot, Github } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';

import { GithubRepository } from '~/github-module';

function formatNumber(num: number): string {
  return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num?.toString();
}

export const RepositoryCard: React.FC<{
  repo: GithubRepository;
}> = ({ repo }) => {
  return (
    <Card key={repo.name} className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl">
          <div className="flex justify-between gap-2">
            <Link to={repo.html_url} target="_blank">
              <div className="flex items-center gap-2">
                <Badge className="p-0.5 size-5">
                  <Github className="size-fit" />
                </Badge>
                <div className="text-sm font-semibold">{repo.name}</div>
              </div>
            </Link>

            <Badge variant="secondary" className="mb-0">
              <CircleDot className="w-4 h-4 mr-1" />
              {repo.language}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-xs text-muted-foreground">{repo.description}</div>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center">
          <Star className="w-4 h-4 mr-1" />
          <span className="mr-4">{formatNumber(repo.stargazers_count)}</span>
          <GitFork className="w-4 h-4 mr-1" />
          <span>{formatNumber(repo.forks_count)}</span>
        </div>
        <div className="flex items-center">
          <Eye className="w-4 h-4 mr-1" />
          <span>{formatNumber(repo.watchers_count)}</span>
        </div>
      </CardFooter>
    </Card>
  );
};
