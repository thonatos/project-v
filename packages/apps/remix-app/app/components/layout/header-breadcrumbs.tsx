import { Link, useMatches } from '@remix-run/react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';

export const Breadcrumbs = () => {
  const matches: Array<any> = useMatches();
  const matchesBreadcrumbs = matches.filter((match) => match.handle && match.handle.breadcrumb);
  const lastMatchBreadcrumbIndex = matchesBreadcrumbs.length - 1;

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {matchesBreadcrumbs.map((match, index) => {
          const currentBreadcrumb = match.handle.breadcrumb(match);

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
