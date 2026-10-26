/**
 * Inset-grouped lists: the one way the app shows records. A `Section` is a
 * label, a rounded group of `Cell`s, and an optional footer. Cells draw their
 * own separators so the group never needs a border.
 */
import { Text, View, type JSX } from 'nsh';
import { Button } from 'nsh/base';
import { Symbol } from './native';
import { font, ink, inset, line, radius, size, state, surface, symbol, type NativeColor } from './tokens';

export function Section(props: { label?: string; footer?: string; children?: JSX.Element; testID?: string }) {
  return (
    <View class={`w-full ${inset.sectionTop}`} testID={props.testID}>
      <If when={props.label}>
        <Text class={`${inset.sectionLabel} ${font.sectionLabel} ${ink.secondary}`}>{props.label}</Text>
      </If>
      <View class={`w-full overflow-hidden ${radius.cell} ${surface.cell}`}>{props.children}</View>
      <If when={props.footer}>
        <Text class={`${inset.sectionFooter} ${font.detail} ${ink.secondary}`}>{props.footer}</Text>
      </If>
    </View>
  );
}

export interface CellProps {
  title: string;
  /** A second line under the title. */
  detail?: string;
  /** Right-aligned value (settings style). */
  value?: string;
  /** Anything before the title: a symbol, a tile. */
  leading?: JSX.Element;
  /** Anything at the end: a toggle, a chip. Replaces the chevron. */
  trailing?: JSX.Element;
  /** Shows a chevron and makes the cell pressable. */
  onPress?: () => void;
  /** Draws the title as an action (accent) or a destructive action. */
  role?: 'action' | 'destructive';
  mono?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** No separator under it (the last cell of a section). */
  last?: boolean;
  tall?: boolean;
  testID?: string;
}

/** One record. 44pt for one line, 56pt for a service row; 16pt insets; separator aligned with the title. */
export function Cell(props: CellProps) {
  const titleClass = () => {
    if (props.role === 'destructive') return `${font.body} ${ink.danger}`;
    if (props.role === 'action') return `${font.body} ${ink.accent}`;
    return `${font.body} ${ink.primary}`;
  };
  const body = () => (
    <View class={`w-full flex-row items-center ${inset.row} ${inset.cell}`}>
      <If when={props.leading}>{props.leading}</If>
      <View class={`min-w-0 flex-1 flex-row items-center ${inset.row} ${inset.cellY} ${props.last ? '' : line.bottom}`}>
        <View class={`min-w-0 flex-1 ${inset.tight}`}>
          <Text numberOfLines={1} class={titleClass()}>
            {props.title}
          </Text>
          <If when={props.detail}>
            <Text numberOfLines={2} class={`${props.mono ? font.mono : font.detail} ${ink.secondary}`}>
              {props.detail}
            </Text>
          </If>
        </View>
        <If when={props.value}>
          <Text
            numberOfLines={1}
            class={`max-w-[60%] text-right ${props.mono ? font.mono : font.body} ${ink.secondary}`}
          >
            {props.value}
          </Text>
        </If>
        <If when={props.trailing}>{props.trailing}</If>
        <If when={props.onPress && !props.trailing && !props.role}>
          <Symbol name="chevron.right" size={symbol.chevron} weight="semibold" color="tertiary" />
        </If>
      </View>
    </View>
  );
  return (
    <If
      when={props.onPress}
      else={
        <View class={`w-full ${props.tall ? size.serviceCell : size.cell} justify-center`} testID={props.testID}>
          {body()}
        </View>
      }
    >
      <Button
        onPress={props.onPress}
        disabled={props.disabled ?? false}
        role="button"
        accessibilityLabel={props.accessibilityLabel ?? (props.detail ? `${props.title}，${props.detail}` : props.title)}
        class={`w-full ${props.tall ? size.serviceCell : size.cell} justify-center ${state.cellPress} ${state.disabled}`}
        testID={props.testID}
      >
        {body()}
      </Button>
    </If>
  );
}

/** A symbol in a small rounded tile, for settings-style cells. */
export function IconTile(props: { name: string; color?: NativeColor; tile?: string }) {
  return (
    <View class={`${size.iconTile} items-center justify-center ${radius.tile} ${props.tile ?? surface.accentSoft}`}>
      <Symbol name={props.name} size={symbol.tile} weight="semibold" color={props.color ?? 'accent'} />
    </View>
  );
}
