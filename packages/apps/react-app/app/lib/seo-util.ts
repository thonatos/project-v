import { REMIX_WEB } from '~/constants';

export const getMeta = (options: { 
  pathname: string,
  title?: string,
  description?: string,
}) => {  
  const { baseUrl, base, twitter, openGraph } = REMIX_WEB;
  
  const url = new URL(options.pathname, baseUrl);
  const title = options.title || base.name;
  const description = options.description || base.description;
  
  return [
    // Site    
    { name: 'author', content: base.creator },
    { name: 'creator', content: base.creator },    
    { name: 'keywords', content: base.keywords },
    { name: 'description', content: base.description },

    // Twitter
    { name: 'twitter:card', content: twitter.card },
    { name: 'twitter:site', content: base.creator },
    { name: 'twitter:creator', content: base.creator },

    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: openGraph.image },
    { name: 'twitter:image:width', content: openGraph.width },
    { name: 'twitter:image:height', content: openGraph.height },

    // Open Graph
    { property: 'og:url', content: url },

    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: openGraph.image },
    { property: 'og:image:width', content: openGraph.width },
    { property: 'og:image:height', content: openGraph.height },
  ];  
}
