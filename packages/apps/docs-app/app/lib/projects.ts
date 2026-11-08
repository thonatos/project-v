export interface Project {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: 'Active' | 'Experimental' | 'Archived';
  platforms: string[];
  href: string;
}

export const projects: Project[] = [
  {
    slug: 'vela',
    name: 'Vela',
    tagline: '在自己的设备之间，访问 Mac 本地服务',
    description: 'Vela 连接同一 Tailnet 中的 Mac 与 iPhone，让你明确选择哪些本地 Web 或 TCP 服务可供自己的设备访问。',
    status: 'Active',
    platforms: ['macOS', 'iOS'],
    href: '/projects/vela',
  },
];

export const featuredProject = projects[0];
