/**
 * Form sheet: the dialog frame. Its header uses the same title style and
 * tokens as `PageHeader`, so a dialog reads as part of the page it opens from.
 */
import { Text, View, type JSX } from "nsh";
import { edges, spacing, surfaces, text, type } from "./tokens";

export function FormSheet(props: { title: string; description?: string; actions: JSX.Element; children?: JSX.Element; testID?: string }) {
  return <View testID={props.testID} class={`h-full w-full ${surfaces.surface}`}>
    <View class={`gap-1 p-4 ${edges.bottom}`}>
      <Text class={`${type.pageTitle} ${text.primary}`}>{props.title}</Text>
      <If when={props.description}><Text class={`${type.caption} ${text.muted}`}>{props.description}</Text></If>
    </View>
    <View class={`min-h-0 flex-1 p-4 ${spacing.pageGap}`}>{props.children}</View>
    <View class={`min-h-[56px] flex-row items-center justify-end p-4 ${spacing.inline} ${edges.top}`}>{props.actions}</View>
  </View>;
}
