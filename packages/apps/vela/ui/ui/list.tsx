/**
 * List, after shadcn/ui's composable rows: `ListRow` is the only data row in
 * Vela. It owns the row height, padding, separators, the leading/content/
 * trailing layout and truncation, so no page or feature lays out a row itself.
 */
import { Text, View, type JSX } from "nsh";
import { edges, spacing, states, surfaces, text, type } from "./tokens";

export interface ListRowProps {
  title: string;
  /** Secondary lines under the title; each truncates on its own. */
  description?: string | readonly string[];
  /** Render the description in the monospace face, for addresses and ports. */
  mono?: boolean;
  /** Inline next to the title, e.g. a status badge. */
  badge?: JSX.Element;
  leading?: JSX.Element;
  /** Controls on the right. A whole-row press and these must not overlap. */
  trailing?: JSX.Element;
  /**
   * Content under the text that needs the full row width, such as an
   * `Endpoint`. Trailing controls stay beside the title.
   */
  footer?: JSX.Element;
  /** Makes the whole row navigate; shows a disclosure chevron. */
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function List(props: { children?: JSX.Element; empty?: JSX.Element; count?: number; testID?: string }) {
  // The rows stay a sibling of their own instead of a branch of an `If`: a
  // branch would read the children getter inside the effect that shows it,
  // so every change to the list would build a new `Each` and remake every
  // row, native switches included, rather than only the rows that changed.
  return <View testID={props.testID}>
    {props.children}
    <If when={props.count === 0}>{props.empty}</If>
  </View>;
}

export function ListRow(props: ListRowProps) {
  const lines = () => (props.description === undefined ? [] : typeof props.description === "string" ? [props.description] : [...props.description]);
  const body = () => <>
    {props.leading}
    <View class="min-w-0 flex-1">
      <View class={`flex-row items-center ${spacing.inline}`}>
        <Text numberOfLines={1} class={`min-w-0 shrink ${type.labelStrong} ${text.primary}`}>{props.title}</Text>
        {props.badge}
      </View>
      <Each of={lines()}>{(line) => (
        <Text numberOfLines={1} selectable={props.mono} class={`${props.mono ? type.mono : type.caption} ${text.muted}`}>{line()}</Text>
      )}</Each>
    </View>
    {props.trailing}
    <If when={props.onPress}><Text class={`${type.label} ${text.muted}`}>›</Text></If>
  </>;
  // Sized to content: a 16pt title line plus 6pt padding. The 32pt floor only
  // exists so a trailing small switch (24pt) never touches the separators.
  const frame = `min-h-[32px] flex-row items-center gap-3 px-4 py-1.5 first:border-t-0 ${edges.top}`;
  // A footer row stacks: the title line keeps its trailing control, and the
  // footer gets the full width beneath it.
  const stacked = () => <View testID={props.testID} class={`gap-1.5 px-4 py-1.5 first:border-t-0 ${edges.top}`}>
    <View class="min-h-[24px] flex-row items-center gap-3">{body()}</View>
    {props.footer}
  </View>;
  const plain = () => <If when={props.footer} else={<View testID={props.testID} class={frame}>{body()}</View>}>{stacked()}</If>;
  return <If when={props.onPress} else={plain()}>
    <View
      testID={props.testID}
      onPress={props.disabled ? undefined : props.onPress}
      disabled={props.disabled}
      role="button"
      accessibilityLabel={props.accessibilityLabel ?? props.title}
      accessibilityState={{ selected: props.selected ?? false, disabled: props.disabled ?? false }}
      class={`${frame} ${states.hover} ${states.disabled}`}
      classList={{ [surfaces.selected]: props.selected ?? false }}
    >{body()}</View>
  </If>;
}

/** The empty state inside a card: a short message and an optional action. */
export function ListEmpty(props: { title: string; description?: string; action?: JSX.Element }) {
  return <View class="items-center gap-2 p-4">
    <Text class={`${type.labelStrong} ${text.primary}`}>{props.title}</Text>
    <If when={props.description}><Text class={`text-center ${type.caption} ${text.muted}`}>{props.description}</Text></If>
    {props.action}
  </View>;
}
