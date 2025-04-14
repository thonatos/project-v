const getPaginationInfo = (input: string) => {
  // const input = '<https://api.github.com/user/958063/starred?per_page=100&page=2>; rel="next", <https://api.github.com/user/958063/starred?per_page=100&page=25>; rel="last"';
  const regex = /<([^>]+)>;\s*rel="([^"]+)"/g;

  let matches;
  let paginationInfo: Record<string, string> = {};

  while ((matches = regex.exec(input)) !== null) {
    const [_, url, type] = matches;
    paginationInfo[type] = url;
  }

  return paginationInfo;
};

export const queryStarredRepoList = async (options?: {
  url?: string;
  pageSize?: number;
  pageNumber?: number;
}) => {
  const { url, pageNumber = 1, pageSize = 100 } = options || {};
  const target =
    url || `https://api.github.com/users/thonatos/starred?per_page=${pageSize}&page=${pageNumber}`;

  const params: any = {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  };

  const res = await fetch(target, params);
  const link = res.headers.get('Link');
  const pagination = getPaginationInfo(link || '');

  const data = await res.json();

  return {
    data,
    pagination,
  };
};
