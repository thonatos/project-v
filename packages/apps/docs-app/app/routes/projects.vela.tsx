import { ArrowDownToLine, ArrowUpRight, BookOpen, Github, LockKeyhole, Monitor, Smartphone } from 'lucide-react';
import { Link } from 'react-router';
import { PageShell } from '~/components/page-shell';
import { pageTitle } from '~/lib/seo';

const RELEASES = 'https://github.com/thonatos/project-v/releases?q=vela-v&expanded=true';
const SOURCE = 'https://github.com/thonatos/project-v/tree/main/packages/apps/vela';
const USER_GUIDE = 'https://github.com/thonatos/project-v/blob/main/packages/apps/vela/docs/user-guide.md';

export function meta() {
  return [
    { title: pageTitle('Vela', 'Projects') },
    { name: 'description', content: '在自己的设备之间，安全访问 Mac 上明确共享的本地服务。' },
  ];
}

export default function VelaProject() {
  return (
    <PageShell width="full" shellClassName="vela-shell">
      <div className="vela-page">
        <section className="vela-hero">
          <div className="vela-wordmark">
            <img src="/projects/vela/sails.svg" alt="" width="40" height="40" />
            <span>VELA</span>
          </div>
          <div className="vela-hero-grid">
            <div>
              <p className="section-kicker">Mac 本地服务 · 个人设备访问</p>
              <h1>在自己的设备之间，访问 Mac 本地服务。</h1>
              <p>
                Vela 是一套面向个人设备的本地服务共享与访问工具。你在 Mac 上选择要共享的服务，自己的其他 Mac 或 iPhone
                通过同一 Tailnet 访问它们。
              </p>
              <div className="vela-actions">
                <a href={RELEASES} className="button-vela">
                  <ArrowDownToLine aria-hidden="true" />
                  获取 macOS 版
                </a>
                <a href={USER_GUIDE} className="button-vela-secondary">
                  <BookOpen aria-hidden="true" />
                  使用说明
                </a>
              </div>
              <p className="vela-requirement">GitHub Releases 直接分发 · Apple Silicon · macOS 14+</p>
            </div>
            <div className="vela-route" aria-label="共享 Mac 上的本地服务通过 Vela 私人连接供自己的 Mac 或 iPhone 访问">
              <div className="vela-device">
                <Monitor aria-hidden="true" />
                <span>共享端 Mac</span>
                <strong>明确启用的本地服务</strong>
              </div>
              <div className="vela-route-track">
                <span>身份验证与授权</span>
                <i />
              </div>
              <div className="vela-device">
                <div className="vela-access-icons" aria-hidden="true">
                  <Monitor />
                  <Smartphone />
                </div>
                <span>访问端</span>
                <strong>Mac 或 iPhone</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="vela-section vela-how">
          <div>
            <p className="section-kicker">访问过程</p>
            <h2>从明确共享，到本地访问。</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>选择要共享的服务</h3>
              <p>在 Mac 上添加已经运行的 loopback Web 或 TCP 服务，并逐项开启共享。新安装不会默认共享任何服务。</p>
            </li>
            <li>
              <span>02</span>
              <h3>验证访问设备</h3>
              <p>连接先经过 Tailscale 身份识别和 Vela 授权。私人端口只存在于 Vela 的嵌入式 Tailnet 节点。</p>
            </li>
            <li>
              <span>03</span>
              <h3>在访问端建立本地映射</h3>
              <p>Mac 获得稳定的本地地址或 TCP 连接命令；iPhone 在应用内打开已共享的 Web 服务。</p>
            </li>
          </ol>
        </section>

        <section className="vela-section vela-split">
          <div>
            <Monitor aria-hidden="true" />
            <p className="section-kicker">macOS</p>
            <h2>共享，也访问</h2>
            <ul>
              <li>添加并检查本机 Web 与 TCP 服务</li>
              <li>逐项控制共享，管理远端 Mac 和本地转发</li>
              <li>Web 服务交给系统浏览器，TCP 服务提供本地连接命令</li>
            </ul>
          </div>
          <div>
            <Smartphone aria-hidden="true" />
            <p className="section-kicker">iOS</p>
            <h2>浏览已共享的 Web 服务</h2>
            <ul>
              <li>添加并管理自己的远端 Mac</li>
              <li>在应用内浏览 Mac 共享的 Web 服务</li>
              <li>TCP 服务可识别，但转发仅由 Mac 提供</li>
            </ul>
          </div>
        </section>

        <section className="vela-section vela-security">
          <LockKeyhole aria-hidden="true" />
          <div>
            <p className="section-kicker">访问边界</p>
            <h2>只开放你明确允许的服务。</h2>
          </div>
          <p>
            Vela 只接受你手动添加并启用的 loopback 目标。远端连接必须通过身份与授权检查，服务自身的密码、token 和 Cookie
            继续生效。Vela 不把端口暴露到局域网或公网，也不修改系统 VPN、代理、DNS 或路由。
          </p>
        </section>

        <section className="vela-section vela-more">
          <div>
            <p className="section-kicker">更多信息</p>
            <h2>开始使用或了解实现</h2>
          </div>
          <div className="vela-links">
            <a href={USER_GUIDE}>
              <BookOpen aria-hidden="true" />
              <span>
                <strong>用户指南</strong>
                <small>首次连接、共享与故障排查</small>
              </span>
              <ArrowUpRight />
            </a>
            <Link to="/blog/building-vela-with-nsh">
              <span className="link-symbol">⌘</span>
              <span>
                <strong>构建 Vela</strong>
                <small>NSH、Rust 与 Go 的架构取舍</small>
              </span>
              <ArrowUpRight />
            </Link>
            <a href={SOURCE}>
              <Github aria-hidden="true" />
              <span>
                <strong>源代码</strong>
                <small>浏览实现与开发文档</small>
              </span>
              <ArrowUpRight />
            </a>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
