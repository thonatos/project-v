/** A leading mark for a list row: a glyph in a tinted square. */
import { View } from 'nsh';
import { Icon } from './icon';
import { surfaces, text } from './tokens';

export function IconTile(props: { symbol: string }) {
  return (
    <View class={`h-8 w-8 items-center justify-center rounded-panel ${surfaces.subtle}`} accessibilityElementsHidden>
      <Icon symbol={props.symbol} class={text.muted} />
    </View>
  );
}
