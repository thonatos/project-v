import type React from 'react';
import { Link, useMatches } from 'react-router';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';

type HandleWithBreadcrumb = {
  breadcrumb: (match: unknown) => React.ReactNode;
};

export const Breadcrumbs: React.FC = () => {
  const matches = useMatches();
  const matchesBreadcrumbs = matches.filter(
    (match) => match.handle && (match.handle as HandleWithBreadcrumb).breadcrumb,
  );
  const lastMatchBreadcrumbIndex = matchesBreadcrumbs.length - 1;

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {matchesBreadcrumbs.map((match, index) => {
          const currentBreadcrumb = (match.handle as HandleWithBreadcrumb).breadcrumb(match);

          if (index === lastMatchBreadcrumbIndex) {
            return (
              <BreadcrumbItem key={index}>
                <BreadcrumbPage>{currentBreadcrumb}</BreadcrumbPage>
              </BreadcrumbItem>
            );
          }

          return (
            <>
              <BreadcrumbItem key={index}>
                <BreadcrumbLink asChild>
                  <Link to={currentBreadcrumb.props.to}>{currentBreadcrumb}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumbs;
