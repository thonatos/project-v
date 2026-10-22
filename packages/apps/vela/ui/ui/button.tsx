/**
 * Vela's button is a real `NSButton`, so its variants resolve to AppKit bezel
 * and tint colors in `host/src/desktop_controls.rs` rather than to class names.
 * The variant vocabulary still follows shadcn so the views read the same way.
 */
import { type StyleProp, type ViewStyle } from "nsh";
import { nativeComponent } from "nsh/native";

export type ButtonVariant = "primary" | "outline" | "secondary" | "danger" | "plain";

interface NativeProps {
  title: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  symbol?: string;
  iconOnly?: boolean;
}

const NativeButton = nativeComponent<NativeProps, { press: null }>("vela.desktopButton", {
  props: ["title", "variant", "disabled", "symbol", "iconOnly"],
  events: ["press"],
});

export interface ButtonProps extends NativeProps {
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button(props: ButtonProps) {
  return <NativeButton
    title={props.title}
    variant={props.variant ?? "primary"}
    disabled={props.disabled ?? false}
    symbol={props.symbol}
    iconOnly={props.iconOnly}
    onPress={() => props.onPress?.()}
    testID={props.testID}
    accessibilityRole="button"
    accessibilityLabel={props.accessibilityLabel ?? props.title}
    style={[{ height: props.iconOnly ? 28 : 22, width: props.iconOnly ? 28 : undefined }, props.style]}
  />;
}
