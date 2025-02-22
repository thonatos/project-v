export const DATABASE_NAME = 'github';
export const DATABASE_STORE_NAME = 'starred_repositories';

export const TIME_FETCH_STARRED_REPO_LIST = 'fetch_starred_repo_list_time';
export const EVENT_FETCH_STARRED_REPO_LIST = 'fetch_starred_repo_list_event';

export interface GithubRepository {
  id: string;

  description: string;

  name: string;
  full_name: string;

  url: string;
  html_url: string;

  language: string;

  open_issues: number;

  forks: number;
  forks_count: number;

  watchers: number;
  watchers_count: number;

  stargazers_count: number;

  pushed_at: string;
  updated_at: string;
}
