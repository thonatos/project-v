/**
 * Endpoint: where a forwarded service can be reached. Once forwarding is on,
 * the address is the thing the user came for, so it gets its own recessed
 * well with the link rail as its only status mark. The well holds nothing
 * else: at 480pt a real address needs up to 265pt, and actions inside the
 * well would leave it 242pt. Actions belong to the row's title line.
 */
import { Text, View } from "nsh";
import { Button } from "./button";
import { LinkTrack, type LinkPhase } from "./link-track";
import { spacing, surfaces, text, tones, type } from "./tokens";

export interface EndpointProps {
  phase: LinkPhase;
  /** `host:port`, shown without a scheme. */
  address: string;
  /** A line under the address, e.g. the device name on the forwards page. */
  caption?: string;
  /** Pressing the address opens it; present only for web forwards. */
  onOpen?: () => void;
  /** Shown while connecting or after a failure, in place of the address. */
  message?: string;
  onRetry?: () => void;
  testID?: string;
}

export function Endpoint(props: EndpointProps) {
  const failed = () => props.phase === "failed";
  const live = () => props.phase === "forwarding";
  const frame = () => (failed() ? `${tones.danger.surface} ${tones.danger.border}` : surfaces.well);
  const ink = () => (failed() ? tones.danger.text : text.primary);
  return <View testID={props.testID} class={`rounded-control border px-2 py-1.5 flex-row items-center ${spacing.inline} ${frame()}`}>
    <LinkTrack phase={props.phase} />
    <View class="min-w-0 flex-1">
      <If when={live()} else={<Text numberOfLines={2} class={`${type.caption} ${ink()}`}>{props.message ?? ""}</Text>}>
        <Text
          numberOfLines={1}
          selectable
          onPress={props.onOpen}
          accessibilityRole={props.onOpen ? "link" : undefined}
          class={`${type.mono} ${ink()}`}
        >{props.address}</Text>
      </If>
      <If when={props.caption}><Text numberOfLines={1} class={`${type.caption} ${text.muted}`}>{props.caption}</Text></If>
    </View>
    <If when={failed() && props.onRetry}>
      <Button title="重试" variant="outline" onPress={props.onRetry} />
    </If>
  </View>;
}

/** The two actions of a live forward, shown on the row's title line. */
export function EndpointActions(props: { onOpen?: () => void; onCopy: () => void; copyLabel: string }) {
  return <View class={`flex-row items-center ${spacing.inline}`}>
    <If when={props.onOpen}>
      <Button title="在浏览器中打开" symbol="arrow.up.right.square" iconOnly variant="plain" onPress={props.onOpen} />
    </If>
    <Button title={props.copyLabel} symbol="doc.on.doc" iconOnly variant="plain" onPress={props.onCopy} />
  </View>;
}
