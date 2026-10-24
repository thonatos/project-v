/**
 * Chrome: the top bar, a bar button, the primary button, inline notices and
 * the modal page shell. Every secondary destination is a native page sheet.
 */
import { Scroll, Text, View, type JSX } from 'nsh';
import { Button, Dialog, SafeAreaView } from 'nsh/base';
import { Symbol } from './native';
import {
  font,
  ink,
  inset,
  line,
  radius,
  size,
  state,
  surface,
  symbol,
  tone,
  type NativeColor,
  type Tone,
} from './tokens';

/** A 44pt bar button: an SF Symbol or a short text label. */
export function BarButton(props: {
  symbol?: string;
  label: string;
  text?: boolean;
  onPress: () => void;
  color?: NativeColor;
  strong?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Button
      onPress={props.onPress}
      disabled={props.disabled ?? false}
      role="button"
      accessibilityLabel={props.label}
      testID={props.testID}
      class={`${size.touch} items-center justify-center ${inset.bar} ${state.press} ${state.disabled}`}
    >
      <If
        when={props.text || !props.symbol}
        else={<Symbol name={props.symbol ?? ''} size={symbol.bar} weight="medium" color={props.color ?? 'accent'} />}
      >
        <Text class={`${props.strong ? font.bodyStrong : font.body} ${ink.accent}`}>{props.label}</Text>
      </If>
    </Button>
  );
}

/**
 * The top bar: leading, centered title (with an optional subtitle), trailing.
 * The sides are equal width so the title is optically centered.
 */
export function TopBar(props: {
  title: string;
  subtitle?: string;
  subtitleTone?: Tone;
  center?: JSX.Element;
  leading?: JSX.Element;
  trailing?: JSX.Element;
  onTitlePress?: () => void;
}) {
  const title = () => (
    <View class="min-w-0 flex-1 items-center" accessibilityLabel={props.title}>
      <If
        when={props.center}
        else={
          <Text numberOfLines={1} class={`${font.heading} ${ink.primary}`}>
            {props.title}
          </Text>
        }
      >
        {props.center}
      </If>
      <If when={props.subtitle}>
        <Text
          numberOfLines={1}
          class={`${font.micro} ${props.subtitleTone ? tone[props.subtitleTone].ink : ink.secondary}`}
        >
          {props.subtitle}
        </Text>
      </If>
    </View>
  );
  return (
    <SafeAreaView edges={['top']} class={`${surface.bar} ${line.bottom}`}>
      <View class={`${size.bar} flex-row items-center ${inset.bar}`}>
        <View class={`${size.barSide} flex-row items-center`}>{props.leading}</View>
        <If when={props.onTitlePress} else={title()}>
          <Button
            onPress={props.onTitlePress}
            role="button"
            accessibilityLabel={props.title}
            class={`min-w-0 flex-1 ${state.press}`}
          >
            {title()}
          </Button>
        </If>
        <View class={`${size.barSide} flex-row items-center justify-end`}>{props.trailing}</View>
      </View>
    </SafeAreaView>
  );
}

/** The one filled button style; 48pt tall, full width by default. */
export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  testID?: string;
}) {
  return (
    <Button
      onPress={props.onPress}
      disabled={(props.disabled ?? false) || (props.busy ?? false)}
      role="button"
      accessibilityLabel={props.label}
      testID={props.testID}
      class={`w-full ${size.button} items-center justify-center ${radius.control} ${props.destructive ? tone.danger.soft : surface.accent} ${state.press} ${state.disabled}`}
    >
      <Text class={`${font.bodyStrong} ${props.destructive ? ink.danger : ink.onAccent}`}>
        {props.busy ? `${props.label}…` : props.label}
      </Text>
    </Button>
  );
}

/** An inline notice. Says what happened and, optionally, offers the fix. */
export function Notice(props: {
  tone: Tone;
  title: string;
  detail?: string;
  action?: { label: string; onPress: () => void };
  symbol?: string;
}) {
  const symbolColor = (): NativeColor =>
    props.tone === 'danger'
      ? 'danger'
      : props.tone === 'warning'
        ? 'warning'
        : props.tone === 'success'
          ? 'success'
          : props.tone === 'offline'
            ? 'secondary'
            : 'accent';
  return (
    <View class={`w-full flex-row ${inset.row} ${inset.banner} ${radius.cell} ${tone[props.tone].soft}`} role="alert">
      <Symbol
        name={
          props.symbol ??
          (props.tone === 'danger'
            ? 'exclamationmark.triangle.fill'
            : props.tone === 'warning'
              ? 'exclamationmark.circle.fill'
              : 'info.circle.fill')
        }
        size={symbol.body}
        color={symbolColor()}
      />
      <View class={`min-w-0 flex-1 ${inset.tight}`}>
        <Text class={`${font.detailStrong} ${tone[props.tone].ink}`}>{props.title}</Text>
        <If when={props.detail}>
          <Text class={`${font.detail} ${ink.secondary}`}>{props.detail}</Text>
        </If>
        <If when={props.action}>
          <Button
            onPress={props.action?.onPress}
            role="button"
            accessibilityLabel={props.action?.label}
            class={`self-start ${state.press}`}
          >
            <Text class={`${font.detailStrong} ${ink.accent}`}>{props.action?.label}</Text>
          </Button>
        </If>
      </View>
    </View>
  );
}

/** A centered empty or loading state. */
export function EmptyState(props: { symbol: string; title: string; detail?: string; action?: JSX.Element }) {
  return (
    <View class={`w-full items-center ${inset.stack} ${inset.empty}`}>
      <Symbol name={props.symbol} size={symbol.empty} weight="regular" color="tertiary" />
      <Text class={`text-center ${font.title} ${ink.primary}`}>{props.title}</Text>
      <If when={props.detail}>
        <Text class={`text-center ${font.detail} ${ink.secondary}`}>{props.detail}</Text>
      </If>
      <If when={props.action}>
        <View class={`w-full ${inset.emptyAction}`}>{props.action}</View>
      </If>
    </View>
  );
}

/**
 * A native page sheet (system grabber, swipe down to close), framed like a
 * tab page so every screen reads the same:
 *
 *   ┌ grabber ───────────────────────────────────┐
 *   │ [取消]                        [完成 | 保存] │  44pt control row
 *   │ Title                           [actions]  │  same 22pt title as tabs
 *   ├────────────────────────────────────────────┤
 *   │ grouped content (scrolls)                  │
 *   └────────────────────────────────────────────┘
 *
 * `cancel` puts a text button on the left (forms); `confirm` replaces Done
 * on the right. Sheets without a form only have Done.
 */
export function PageSheet(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  cancel?: { label: string; onPress: () => void };
  confirm?: { label: string; onPress: () => void; disabled?: boolean };
  actions?: JSX.Element;
  children?: JSX.Element;
  testID?: string;
}) {
  return (
    <Dialog
      open={props.open}
      presentation="pageSheet"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      class={`flex-1 ${surface.sheet}`}
      testID={props.testID}
    >
      <View class={`flex-1 ${surface.sheet}`}>
        <View class={`${size.bar} ${inset.sheetHeader} flex-row items-center justify-between ${inset.bar}`}>
          <View class="flex-row items-center">
            <If when={props.cancel}>
              <BarButton label={props.cancel?.label ?? ''} text onPress={() => props.cancel?.onPress()} />
            </If>
          </View>
          <If when={props.confirm} else={<BarButton label="完成" text strong onPress={props.onClose} />}>
            <BarButton
              label={props.confirm?.label ?? ''}
              text
              strong
              disabled={props.confirm?.disabled}
              onPress={() => props.confirm?.onPress()}
            />
          </If>
        </View>
        <View class={`${size.pageHeader} flex-row items-center ${inset.headerLeft} ${inset.headerRight}`}>
          <View class={`${size.bar} min-w-0 flex-1 flex-row items-center`}>
            <Text numberOfLines={1} class={`${font.pageTitle} ${ink.primary}`} role="header">
              {props.title}
            </Text>
          </View>
          <If when={props.actions}>
            <View class={`${size.bar} flex-row items-center`}>{props.actions}</View>
          </If>
        </View>
        <Scroll
          scrollbar={false}
          keyboardDismissMode="interactive"
          class="flex-1"
          contentClass={`grow ${inset.screen} ${inset.pageBottom}`}
        >
          <View class="w-full">{props.children}</View>
        </Scroll>
      </View>
    </Dialog>
  );
}

/**
 * Every tab page has the same frame:
 *
 *   ┌ fixed header ──────────────────────────────┐
 *   │ [brand | title]                  [actions] │  under the status bar
 *   ├────────────────────────────────────────────┤
 *   │ grouped content (scrolls)                  │
 *   │ ... clears the floating tab bar at the end │
 *   └────────────────────────────────────────────┘
 *
 * `brand` replaces the title (the home tab shows the Vela mark).
 */
export function TabPage(props: {
  title: string;
  brand?: JSX.Element;
  actions?: JSX.Element;
  children?: JSX.Element;
  onRefresh?: () => void;
  refreshing?: boolean;
  testID?: string;
}) {
  return (
    <View class={`flex-1 ${surface.canvas}`} testID={props.testID}>
      <SafeAreaView edges={['top']} class={surface.canvas}>
        {/* One 44pt row: the title box and the 44pt action buttons share its
          height, so their centers line up. The right inset is the screen
          inset minus the buttons' own padding, so the last glyph aligns with
          the cards' edge. */}
        <View class={`${size.pageHeader} flex-row items-center ${inset.headerLeft} ${inset.headerRight}`}>
          <View class={`${size.bar} min-w-0 flex-1 flex-row items-center`}>
            <If
              when={props.brand}
              else={
                <Text numberOfLines={1} class={`${font.pageTitle} ${ink.primary}`} role="header">
                  {props.title}
                </Text>
              }
            >
              {props.brand}
            </If>
          </View>
          <If when={props.actions}>
            <View class={`${size.bar} flex-row items-center`}>{props.actions}</View>
          </If>
        </View>
      </SafeAreaView>
      <Scroll
        scrollbar={false}
        class="flex-1"
        contentClass={`grow ${inset.screen}`}
        refreshing={props.refreshing ?? false}
        onRefresh={props.onRefresh}
        keyboardDismissMode="interactive"
      >
        <View class="w-full">{props.children}</View>
        <View class={size.tabClearance} />
        <SafeAreaView edges={['bottom']} />
      </Scroll>
    </View>
  );
}
