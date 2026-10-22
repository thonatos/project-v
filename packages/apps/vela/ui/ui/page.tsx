/**
 * Page shell: every top-level pane is the same scroll container, padding and
 * header, so title position and rhythm never differ between pages.
 */
import { Scroll, Text, View, type JSX } from "nsh";
import { spacing, surfaces, text, type } from "./tokens";

export function Page(props: { testID: string; children?: JSX.Element }) {
  return <Scroll showsIndicator={false} class={`flex-1 ${surfaces.canvas}`} contentContainerClass={`grow ${spacing.page}`}>
    <View testID={props.testID} class={`w-full ${spacing.pageGap}`}>{props.children}</View>
  </Scroll>;
}

/**
 * The header at the top of a page. `back` turns it into a breadcrumb for a
 * detail page; `actions` sit on the right in every case.
 */
export function PageHeader(props: { title: string; description?: string; back?: { label: string; onPress: () => void }; actions?: JSX.Element }) {
  return <View class="gap-1">
    <If when={props.back}>
      <View onPress={props.back?.onPress} accessibilityRole="button" accessibilityLabel={`返回${props.back?.label ?? ""}`} class="flex-row items-center gap-1 self-start active:opacity-60">
        <Text class={`${type.caption} ${text.muted}`}>‹ {props.back?.label}</Text>
      </View>
    </If>
    <View class="min-h-[28px] flex-row items-center gap-2">
      <Text numberOfLines={1} class={`min-w-0 flex-1 ${type.pageTitle} ${text.primary}`}>{props.title}</Text>
      {props.actions}
    </View>
    <If when={props.description}><Text class={`${type.caption} ${text.muted}`}>{props.description}</Text></If>
  </View>;
}
