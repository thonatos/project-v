/** The custom WebView: per device+service data store, reload command. */
import { nativeComponent } from 'nsh/native';

export interface NavigationState {
  readonly url: string;
  readonly title: string;
  readonly loading: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export interface WebError {
  readonly message: string;
  readonly url?: string;
  readonly code?: number;
}

/** The page scrolled down (`collapsed`) or back up / to an end. */
export interface ScrollState {
  readonly collapsed: boolean;
  readonly offset: number;
}

/** Whether the page's top is dark; it decides the status bar. */
export interface PageTheme {
  readonly isDark: boolean;
}

export const ServiceWebView = nativeComponent<
  { source: string; dataKey: string; topInset: number; bottomInset: number },
  {
    load: NavigationState;
    error: WebError;
    navigationStateChange: NavigationState;
    scroll: ScrollState;
    theme: PageTheme;
  }
>('vela/webview', {
  props: ['source', 'dataKey', 'topInset', 'bottomInset'],
  events: ['load', 'error', 'navigationStateChange', 'scroll', 'theme'],
});
