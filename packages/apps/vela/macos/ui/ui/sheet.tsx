/**
 * Form sheet: the dialog frame. Its header uses the same title style and
 * tokens as `PageHeader`, so a dialog reads as part of the page it opens from.
 */
import { Text, View, type JSX } from 'nsh';
import { Dialog } from 'nsh/base';
import { edges, geometry, spacing, surfaces, text, type } from './tokens';

export function FormSheet(props: {
  title: string;
  description?: string;
  actions: JSX.Element;
  children?: JSX.Element;
  testID?: string;
}) {
  return (
    <View testID={props.testID} class={`h-full w-full ${surfaces.surface}`}>
      <View class={`gap-0.5 px-4 py-2.5 ${edges.bottom}`}>
        <Text class={`${type.pageTitle} ${text.primary}`}>{props.title}</Text>
        <If when={props.description}>
          <Text class={`${type.caption} ${text.muted}`}>{props.description}</Text>
        </If>
      </View>
      <View class={`min-h-0 flex-1 p-4 ${spacing.pageGap}`}>{props.children}</View>
      <View
        class={`${geometry.sheetFooter} flex-row items-center justify-end px-4 py-2 ${spacing.inline} ${edges.top}`}
      >
        {props.actions}
      </View>
    </View>
  );
}

/**
 * The dialog host for a form sheet. `Dialog`'s own `class` styles the popup,
 * which on the desktops fills the window. The veil covers the content area
 * only: the navigation rail stays outside the modal's dimming and keeps its
 * own color.
 *
 * The blur is NSH's `backdrop-blur` (`NSVisualEffectView`, material
 * `popover`), which is nearly opaque on its own; `opacity-80` keeps a
 * faint outline of the page while the 25% veil dims it. The radius is
 * `lg` because `md` still resolved card edges behind the sheet.
 */
export function FormSheetDialog(props: {
  open: boolean;
  size: 'add-device' | 'rename' | 'service-editor';
  onClose: () => void;
  children: JSX.Element;
}) {
  // Measured for the fixed 480pt utility window. Keeping these named here
  // prevents feature call sites from inventing dialog geometry.
  const geometry = () =>
    ({
      'add-device': { width: 392, height: 520 },
      rename: { width: 392, height: 260 },
      'service-editor': { width: 392, height: 600 },
    })[props.size];
  return (
    <Dialog
      open={props.open}
      animation="fade"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      class="w-full flex-1"
    >
      <View class="absolute inset-y-0 right-0 left-14 backdrop-blur-lg opacity-80" />
      <View class={`absolute inset-y-0 right-0 left-14 ${surfaces.veil}`} />
      <View class={`w-full flex-1 items-center justify-center ${spacing.rail}`}>
        <View class={`overflow-hidden rounded-panel ${edges.all} ${surfaces.surface}`} style={geometry()}>
          {props.children}
        </View>
      </View>
    </Dialog>
  );
}
