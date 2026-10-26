/**
 * A bottom menu: full width, attached to the bottom edge, rounded only at the
 * top, sized to its rows. It slides up from the edge over a dimmed backdrop;
 * a tap on the backdrop, Cancel, or choosing a row closes it.
 */
import { Text, View, type JSX } from 'nsh';
import { Button, Menu as BaseMenu, MenuItem as BaseMenuItem, MenuSeparator, SafeAreaView } from 'nsh/base';
import { Symbol } from './native';
import { font, ink, inset, line, radius, size, state, surface, symbol, type NativeColor } from './tokens';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly symbol?: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly detail?: string;
}

function MenuRow(props: { item: MenuItem; last: boolean; onClose: () => void }) {
  const color = (): NativeColor => (props.item.destructive ? 'danger' : props.item.disabled ? 'tertiary' : 'primary');
  return (
    <BaseMenuItem
      onSelect={() => {
        props.onClose();
        props.item.onSelect();
      }}
      disabled={props.item.disabled ?? false}
      accessibilityLabel={props.item.label}
      class={`w-full ${size.menuRow} flex-row items-center ${inset.cell} ${state.cellPress} ${state.disabled}`}
    >
      <View class={`h-full min-w-0 flex-1 flex-row items-center ${inset.row} ${props.last ? '' : line.bottom}`}>
        <If when={props.item.symbol}>
          <Symbol name={props.item.symbol ?? ''} size={symbol.bar} weight="regular" color={color()} />
        </If>
        <Text
          numberOfLines={1}
          class={`min-w-0 flex-1 ${font.body} ${props.item.destructive ? ink.danger : props.item.disabled ? ink.tertiary : ink.primary}`}
        >
          {props.item.label}
        </Text>
        <If when={props.item.detail}>
          <Text class={`${font.detail} ${ink.tertiary}`}>{props.item.detail}</Text>
        </If>
      </View>
    </BaseMenuItem>
  );
}

/** One group of rows; groups are separated by a gap, like iOS menus. */
function MenuGroup(props: { items: readonly MenuItem[]; onClose: () => void }) {
  return (
    <View class={`w-full overflow-hidden ${radius.cell} ${surface.cell}`}>
      <Each of={props.items} key={(item) => item.id}>
        {(item, index) => <MenuRow item={item()} last={index() === props.items.length - 1} onClose={props.onClose} />}
      </Each>
    </View>
  );
}

export function BottomMenu(props: {
  open: boolean;
  onClose: () => void;
  /** Shown above the groups: what the menu acts on. */
  header?: JSX.Element;
  groups: readonly (readonly MenuItem[])[];
  testID?: string;
}) {
  return (
    <If when={props.open}>
      <BaseMenu
        defaultOpen
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
        popupClass={`w-full ${surface.sheet} ${radius.sheetTop}`}
        backdropClass={surface.scrim}
      >
        <SafeAreaView edges={['bottom']} class="w-full" testID={props.testID}>
          <View class={`w-full items-center ${inset.grabber}`}>
            <View class={`${size.grabber} ${radius.full} ${surface.grabber}`} />
          </View>
          <If when={props.header}>{props.header}</If>
          <View class={`w-full ${inset.screen} ${inset.menuBody}`}>
            <Each
              of={props.groups.filter((group) => group.length > 0)}
              key={(group) => group.map((item) => item.id).join(':')}
            >
              {(group, index) => (
                <>
                  <If when={index() > 0}>
                    <MenuSeparator class={line.top} />
                  </If>
                  <MenuGroup items={group()} onClose={props.onClose} />
                </>
              )}
            </Each>
            <Button
              onPress={props.onClose}
              role="button"
              accessibilityLabel="取消"
              class={`w-full ${size.menuRow} items-center justify-center ${radius.cell} ${surface.cell} ${state.cellPress}`}
            >
              <Text class={`${font.bodyStrong} ${ink.accent}`}>取消</Text>
            </Button>
          </View>
        </SafeAreaView>
      </BaseMenu>
    </If>
  );
}
