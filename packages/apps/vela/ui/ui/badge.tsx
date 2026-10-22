/**
 * Status in words, colored by meaning. A status is said once: there is no dot
 * beside the badge, and color is never the only signal.
 */
import { Text } from "nsh";
import { statusText, type, type StatusKey } from "./tokens";

export function Badge(props: { status: StatusKey; children: string }) {
  return <Text numberOfLines={1} class={`${type.caption} font-semibold ${statusText[props.status]}`}>{props.children}</Text>;
}
