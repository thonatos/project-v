/** The account mark: an optional Gravatar over a permanent initial fallback. */
import { Image, Text, View } from 'nsh';
import { surfaces, text, type } from './tokens';

export function Avatar(props: { initial: string; signedIn: boolean; large?: boolean; imageUrl?: string }) {
  const frame = () => (props.large ? 'h-14 w-14' : 'h-9 w-9');
  const initials = () => (props.large ? type.pageTitle : type.labelStrong);
  return (
    <View
      class={`${frame()} overflow-hidden items-center justify-center rounded-full ${props.signedIn ? surfaces.accent : surfaces.subtle}`}
      accessibilityElementsHidden
    >
      <Text class={`${initials()} ${props.signedIn ? text.onAccent : text.muted}`}>{props.initial}</Text>
      <If when={props.imageUrl}>
        <Image src={props.imageUrl} resizeMode="cover" fadeDuration={160} class="absolute inset-0" />
      </If>
    </View>
  );
}
