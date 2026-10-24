/**
 * Floating chrome: the tab bar for the four sections, and the browser's
 * Safari-style toolbar that collapses to a small indicator while the page
 * scrolls. Both float above the content, inside the bottom safe area.
 */
import { Text, View, type JSX } from 'nsh';
import { Button, safeAreaInsets } from 'nsh/base';
import { Symbol } from './native';
import { elevation, font, ink, inset, motion, radius, size, state, surface, symbol } from './tokens';

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly symbol: string;
  /** The selected symbol; not every SF Symbol has a `.fill` variant. */
  readonly activeSymbol: string;
}

/** A floating, rounded tab bar pinned above the home indicator. */
/**
 * Where floating chrome sits, as Safari's bottom bar does on iOS 26: it
 * overlaps the home-indicator inset and keeps 20pt from the bottom edge
 * (8pt on devices without a home indicator).
 */
function useBottom() {
  const insets = safeAreaInsets();
  return () => ({ bottom: insets().bottom > 0 ? Math.max(insets().bottom - 14, 8) : 8 });
}

export function FloatingTabBar<T extends string>(props: {
  items: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  const bottom = useBottom();
  return (
    <View class={`absolute inset-x-0 ${inset.floatX}`} style={bottom()} pointerEvents="box-none">
      <View
        class={`w-full ${size.tabBar} flex-row ${inset.tabBar} ${radius.float} ${surface.float} ${elevation.float}`}
        role="tablist"
      >
        <Each of={props.items} key={(item) => item.id}>
          {(item) => {
            const active = () => props.selected === item().id;
            return (
              <Button
                onPress={() => props.onSelect(item().id)}
                selected={active()}
                role="tab"
                accessibilityLabel={item().label}
                class={`h-full min-w-0 flex-1 items-center justify-center ${inset.tab} ${state.press}`}
                testID={`tab-${item().id}`}
              >
                <Symbol
                  name={active() ? item().activeSymbol : item().symbol}
                  size={symbol.tab}
                  weight={active() ? 'semibold' : 'regular'}
                  color={active() ? 'accent' : 'secondary'}
                />
                <Text numberOfLines={1} class={`${font.micro} ${active() ? ink.accent : ink.secondary}`}>
                  {item().label}
                </Text>
              </Button>
            );
          }}
        </Each>
      </View>
    </View>
  );
}

/** One toolbar control: a 44pt symbol button. */
export function ToolButton(props: { symbol: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Button
      onPress={props.onPress}
      disabled={props.disabled ?? false}
      role="button"
      accessibilityLabel={props.label}
      class={`${size.touch} items-center justify-center ${state.press} ${state.disabled}`}
    >
      <Symbol name={props.symbol} size={symbol.bar} weight="medium" color={props.disabled ? 'tertiary' : 'accent'} />
    </Button>
  );
}

/**
 * The browser toolbar. Expanded: controls and an address pill. Collapsed:
 * only a small pill with the service name; tapping it expands again.
 */
export function BrowserToolbar(props: {
  collapsed: boolean;
  onExpand: () => void;
  title: string;
  subtitle: string;
  loading: boolean;
  onAddress: () => void;
  leading: JSX.Element;
  trailing: JSX.Element;
}) {
  const bottom = useBottom();
  return (
    <View class={`absolute inset-x-0 items-center ${inset.floatX}`} style={bottom()} pointerEvents="box-none">
      <If
        when={props.collapsed}
        else={
          <View
            class={`w-full ${size.toolbar} flex-row items-center ${inset.toolbar} ${radius.float} ${surface.float} ${elevation.float} ${motion.bar}`}
          >
            {props.leading}
            <Button
              onPress={props.onAddress}
              role="button"
              accessibilityLabel={`${props.title}，${props.subtitle}`}
              class={`${size.address} min-w-0 flex-1 flex-row items-center justify-center ${inset.address} ${radius.full} ${surface.fill} ${state.press}`}
            >
              <Symbol
                name={props.loading ? 'arrow.triangle.2.circlepath' : 'lock.fill'}
                size={symbol.badge}
                weight="semibold"
                color="secondary"
              />
              <View class="min-w-0 items-center">
                <Text numberOfLines={1} class={`${font.detailStrong} ${ink.primary}`}>
                  {props.title}
                </Text>
                <Text numberOfLines={1} class={`${font.micro} ${ink.secondary}`}>
                  {props.subtitle}
                </Text>
              </View>
            </Button>
            {props.trailing}
          </View>
        }
      >
        <Button
          onPress={props.onExpand}
          role="button"
          accessibilityLabel={`展开工具栏，${props.title}`}
          class={`${size.indicator} flex-row items-center ${inset.indicator} ${radius.full} ${surface.float} ${elevation.float} ${motion.bar} ${state.press}`}
        >
          <Symbol name="lock.fill" size={symbol.badge} weight="semibold" color="secondary" />
          <Text numberOfLines={1} class={`${font.micro} ${ink.primary}`}>
            {props.title}
          </Text>
        </Button>
      </If>
    </View>
  );
}
