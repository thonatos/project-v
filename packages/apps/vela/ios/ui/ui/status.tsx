/** Small status atoms: a dot, a chip, a monogram, an avatar. */
import { Image, Text, View } from 'nsh';
import { font, hue, ink, inset, radius, size, surface, tone, type Tone } from './tokens';

export function Dot(props: { tone: Tone }) {
  return <View class={`${size.dot} ${radius.full} ${tone[props.tone].dot}`} accessibilityElementsHidden />;
}

/** Text status with a tinted background. Used where a dot alone is ambiguous. */
export function Chip(props: { tone: Tone; label: string }) {
  return (
    <View class={`flex-row items-center ${inset.tight} ${inset.chip} ${radius.full} ${tone[props.tone].soft}`}>
      <Text class={`${font.microStrong} ${tone[props.tone].ink}`}>{props.label}</Text>
    </View>
  );
}

/** A stable color index from any key. */
export function hueIndex(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % hue.length;
}

/** The first letter of a service, on its device's color. */
export function Monogram(props: { label: string; colorKey: string; muted?: boolean }) {
  const palette = () => hue[hueIndex(props.colorKey)];
  const letter = () => (props.label.trim().slice(0, 1) || '?').toUpperCase();
  return (
    <View
      class={`${size.tile} items-center justify-center ${radius.tile} ${props.muted ? surface.fill : palette().tile}`}
      accessibilityElementsHidden
    >
      <Text class={`${font.bodyStrong} ${props.muted ? ink.tertiary : palette().ink}`}>{letter()}</Text>
    </View>
  );
}

/** The account mark: optional Gravatar over a permanent initial fallback. */
export function Avatar(props: { initial: string; signedIn: boolean; large?: boolean; imageUrl?: string }) {
  return (
    <View
      class={`${props.large ? size.avatarLarge : size.avatar} overflow-hidden items-center justify-center ${radius.full} ${props.signedIn ? surface.accent : surface.fill}`}
      accessibilityElementsHidden
    >
      <Text
        class={`${props.large ? font.pageTitle : font.detailStrong} ${props.signedIn ? ink.onAccent : ink.secondary}`}
      >
        {props.initial}
      </Text>
      <If when={props.imageUrl}>
        <Image src={props.imageUrl} resizeMode="cover" fadeDuration={160} class="absolute inset-0" />
      </If>
    </View>
  );
}
