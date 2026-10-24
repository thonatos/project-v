/**
 * The browser: one service, full screen, like Safari. The page runs from the
 * status bar to the bottom edge; the toolbar floats at the bottom and
 * collapses to a small indicator while the page scrolls down.
 *
 *   expanded   [‹] [›] [ 🔒 opencode · vela-macmini ] [⋯] [▦]
 *   collapsed              ( 🔒 opencode )
 */
import { Scroll, View, effect, type YNode } from 'nsh';
import { SafeAreaView, safeAreaInsets } from 'nsh/base';
import {
  BrowserToolbar,
  EmptyState,
  Notice,
  PrimaryButton,
  ToolButton,
  browserViewportBottom,
  inset,
  size,
  statusBarBand,
  surface,
  tone,
} from '../../ui';
import { failureDetail, failureTitle, store } from '../../core/store';
import { connectionLabel } from '../../../../shared/ui/devices';
import { ServiceWebView, type NavigationState } from './WebView';

let webview: YNode | undefined;

/** Reloads the visible page (the menu and the error state call it). */
export function reloadPage() {
  store.page.started();
  webview?.command('reload');
}

export function BrowserPage(props: { onMenu: () => void }) {
  const top = safeAreaInsets();
  const stage = () => store.stage();
  const current = () => store.currentService();
  const readyURL = () => {
    const value = stage();
    return value.phase === 'ready' ? value.url : '';
  };
  const failure = () => {
    const value = stage();
    return value.phase === 'error' ? value.failure : 'unknown';
  };
  const dataKey = () => `${current()?.device.privateName ?? ''}/${current()?.service.id ?? ''}`;
  const subtitle = () => {
    const device = current()?.device;
    if (!device) return '';
    if (store.pageLoading()) return '正在加载…';
    return device.connection === 'connected' ? device.name : `${device.name} · ${connectionLabel(device.connection)}`;
  };

  // A page that failed while the app was suspended reloads once the
  // private network is back.
  effect(() => {
    if (store.network() === 'connected' && stage().phase === 'ready' && store.pageError()) {
      setTimeout(reloadPage, 400);
    }
  });

  // Like Safari, the page runs under the status bar; its top color decides
  // whether the status bar content is light or dark. Outside a ready page
  // the status bar follows the app again.
  effect(() => {
    const showing = store.browsing() && stage().phase === 'ready';
    const dark = store.pageDark();
    store.page.statusBar(showing && dark !== null ? (dark ? 'dark' : 'light') : 'app');
  });

  return (
    <View class={`flex-1 ${surface.canvas}`}>
      {/* Like Safari: the page fills the whole screen, under the status bar and
        the floating toolbar. Nothing of the app is painted behind it; the
        obscured insets tell the page which edges the chrome covers. */}
      <If when={stage().phase === 'ready'}>
        <View class="absolute inset-0">
          {/* Keep the layout viewport stable. Collapsing the toolbar is only a
            visual change; changing WKWebView's inset while an inner page
            scroller is moving pans iOS 26's visual viewport by the top inset
            and it may never return after the keyboard closes. */}
          <ServiceWebView
            source={readyURL()}
            dataKey={dataKey()}
            topInset={Math.min(top().top, statusBarBand)}
            bottomInset={browserViewportBottom}
            style={{ flexGrow: 1, flexShrink: 1 }}
            ref={(node: YNode) => {
              webview = node;
            }}
            onLoad={(state: NavigationState) => store.page.loaded(state.title)}
            onNavigationStateChange={(state: NavigationState) => store.page.navigated(state)}
            onError={(error) => store.page.failed(error.message)}
            onScroll={(event) => store.page.scrolled(event.collapsed)}
            onTheme={(event) => store.page.themed(event.isDark)}
          />
        </View>
        <View
          class={`absolute inset-x-0 ${size.progress} ${store.pageLoading() ? tone.accent.dot : ''}`}
          style={{ top: top().top }}
          accessibilityElementsHidden
        />
      </If>

      <If when={stage().phase !== 'ready'}>
        <SafeAreaView edges={['top']} />
      </If>

      <If when={stage().phase === 'connecting'}>
        <EmptyState
          symbol="point.3.connected.trianglepath.dotted"
          title={`正在连接 ${current()?.service.name ?? ''}`}
          detail={`通过 Tailnet 连接 ${current()?.device.name ?? ''}…`}
        />
      </If>

      <If when={stage().phase === 'error'}>
        <Scroll class="flex-1" contentClass={`grow ${inset.screen}`}>
          <EmptyState
            symbol={
              failure() === 'offline'
                ? 'wifi.slash'
                : failure() === 'auth'
                  ? 'person.crop.circle.badge.exclamationmark'
                  : 'exclamationmark.triangle'
            }
            title={failureTitle(failure())}
            detail={failureDetail(failure())}
            action={
              <PrimaryButton
                label={failure() === 'auth' ? '登录' : '重试'}
                onPress={failure() === 'auth' ? store.navigation.account : store.navigation.retry}
              />
            }
          />
        </Scroll>
      </If>

      <If when={stage().phase === 'ready' && store.pageError()}>
        <View class={`absolute inset-x-0 ${inset.screen}`} style={{ top: top().top + 8 }} pointerEvents="box-none">
          <Notice
            tone="danger"
            title="页面加载失败"
            detail={store.pageError()}
            action={{ label: '重新加载', onPress: reloadPage }}
          />
        </View>
      </If>

      <BrowserToolbar
        collapsed={store.toolbarCollapsed() && stage().phase === 'ready'}
        onExpand={store.page.expand}
        title={current()?.service.name ?? ''}
        subtitle={subtitle()}
        loading={store.pageLoading()}
        onAddress={props.onMenu}
        leading={
          <>
            <ToolButton
              symbol="chevron.backward"
              label="后退"
              disabled={!store.canGoBack()}
              onPress={() => webview?.command('goBack')}
            />
            <ToolButton
              symbol="chevron.forward"
              label="前进"
              disabled={!store.canGoForward()}
              onPress={() => webview?.command('goForward')}
            />
          </>
        }
        trailing={
          <>
            <ToolButton symbol="ellipsis.circle" label="更多" onPress={props.onMenu} />
            <ToolButton symbol="square.grid.2x2" label="返回服务" onPress={store.navigation.home} />
          </>
        }
      />
    </View>
  );
}
