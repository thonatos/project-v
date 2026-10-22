/**
 * Card, after shadcn/ui: a bordered surface split into header, content and
 * footer regions, so every grouped block on every page has the same frame.
 */
import { Text, View, type JSX } from "nsh";
import { edges, spacing, surfaces, text, type } from "./tokens";

export function Card(props: { children?: JSX.Element; testID?: string }) {
  return <View testID={props.testID} class={`overflow-hidden rounded-panel ${edges.all} ${surfaces.surface}`}>{props.children}</View>;
}

/** A section heading above a card, with an optional action on the right. */
export function CardHeader(props: { title: string; description?: string; action?: JSX.Element }) {
  return <View class={`min-h-[24px] flex-row items-center ${spacing.inline}`}>
    <View class="min-w-0 flex-1 gap-0.5">
      <Text numberOfLines={1} class={`${type.sectionTitle} ${text.muted}`}>{props.title}</Text>
      <If when={props.description}><Text class={`${type.caption} ${text.muted}`}>{props.description}</Text></If>
    </View>
    {props.action}
  </View>;
}

export function CardContent(props: { children?: JSX.Element }) {
  return <View class={`${spacing.stack} p-4`}>{props.children}</View>;
}

/** A labelled card: header, the card body, and an optional footer note. */
export function CardSection(props: { title: string; description?: string; action?: JSX.Element; footer?: JSX.Element; children?: JSX.Element; testID?: string }) {
  return <View testID={props.testID} class={spacing.sectionGap}>
    <CardHeader title={props.title} description={props.description} action={props.action} />
    <Card>{props.children}</Card>
    {props.footer}
  </View>;
}
