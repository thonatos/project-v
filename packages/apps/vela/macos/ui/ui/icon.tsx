/**
 * A small status glyph. NSH has no SF Symbol image for plain views — only the
 * native button can draw symbols — so tones use a typographic mark that takes
 * its color from the surrounding tone like any text.
 */
import { Text } from 'nsh';

const GLYPHS: Record<string, string> = {
  'info.circle': 'ⓘ',
  'checkmark.circle': '✓',
  'exclamationmark.triangle': '!',
  'xmark.octagon': '✕',
};

export function Icon(props: { symbol: string; size?: 'sm' | 'md'; class?: string }) {
  const size = () => (props.size === 'sm' ? 'text-caption' : 'text-label');
  return (
    <Text accessibilityElementsHidden class={`w-4 text-center font-semibold ${size()} ${props.class ?? ''}`}>
      {GLYPHS[props.symbol] ?? '•'}
    </Text>
  );
}
