/**
 * Vela's button is a real `NSButton`, so its variants resolve to AppKit bezel
 * and tint colors in `host/src/desktop_controls.rs` rather than to class names.
 * The variant vocabulary still follows shadcn so the views read the same way.
 */
import { token, type StyleProp, type ViewStyle } from 'nsh';
import { nativeComponent } from 'nsh/native';

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'danger' | 'plain';

interface NativeProps {
  title: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  symbol?: string;
  iconOnly?: boolean;
  selected?: boolean;
  accent?: string;
  accentForeground?: string;
  danger?: string;
  secondary?: string;
  muted?: string;
  disabledBezel?: string;
  disabledInk?: string;
}

const NativeButton = nativeComponent<NativeProps, { press: null }>('vela.desktopButton', {
  props: [
    'title', 'variant', 'disabled', 'symbol', 'iconOnly', 'accent', 'accentForeground',
    'danger', 'secondary', 'muted', 'disabledBezel', 'disabledInk',
  ],
  events: ['press'],
});

export interface ButtonProps extends NativeProps {
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button(props: ButtonProps) {
  return (
    <NativeButton
      title={props.title}
      variant={props.variant ?? 'secondary'}
      disabled={props.disabled ?? false}
      symbol={props.symbol}
      iconOnly={props.iconOnly}
      accent={token('accent')}
      accentForeground={token('accent-foreground')}
      danger={token('danger')}
      secondary={token('foreground')}
      muted={token('muted-foreground')}
      disabledBezel={token('disabled')}
      disabledInk={token('disabled-foreground')}
      onPress={() => props.onPress?.()}
      testID={props.testID}
      role="button"
      accessibilityState={{ selected: props.selected ?? false, disabled: props.disabled ?? false }}
      accessibilityLabel={props.accessibilityLabel ?? props.title}
      style={[{ height: props.iconOnly ? 28 : 22, width: props.iconOnly ? 28 : undefined }, props.style]}
    />
  );
}
