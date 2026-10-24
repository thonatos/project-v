/**
 * Alert and Callout, after shadcn/ui's Alert: tinted, toned surfaces for
 * conditions that need attention, and a quieter inline note for guidance. They
 * replace long paragraphs of plain text.
 */
import { Text, View, type JSX } from 'nsh';
import { Icon } from './icon';
import { text, tones, type, type Tone } from './tokens';

export function Alert(props: {
  tone?: Tone;
  title?: string;
  description?: string;
  action?: JSX.Element;
  testID?: string;
}) {
  const tone = () => tones[props.tone ?? 'info'];
  return (
    <View
      testID={props.testID}
      role="alert"
      class={`flex-row gap-3 rounded-panel border p-3 ${tone().surface} ${tone().border}`}
    >
      <Icon symbol={tone().symbol} class={tone().text} />
      <View class="min-w-0 flex-1 gap-1">
        <If when={props.title}>
          <Text class={`${type.labelStrong} ${tone().text}`}>{props.title}</Text>
        </If>
        <If when={props.description}>
          <Text class={`${type.caption} ${tone().text}`}>{props.description}</Text>
        </If>
        <If when={props.action}>
          <View class="mt-1 flex-row items-center gap-2">{props.action}</View>
        </If>
      </View>
    </View>
  );
}

/** A one-line note under a field or a card. */
export function Callout(props: { children: string; tone?: 'muted' | Tone }) {
  const tint = () => (props.tone && props.tone !== 'muted' ? tones[props.tone].text : text.muted);
  return (
    <View class="flex-row items-start gap-1.5 px-0.5">
      <Icon symbol="info.circle" size="sm" class={tint()} />
      <Text class={`min-w-0 flex-1 ${type.caption} ${tint()}`}>{props.children}</Text>
    </View>
  );
}
