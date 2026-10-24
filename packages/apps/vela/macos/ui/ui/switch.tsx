/**
 * A native `NSSwitch` for persistent booleans. The switch is the state, so the
 * row around it describes what it does instead of restating "on" or "off".
 */
import { nativeComponent } from 'nsh/native';

const NativeSwitch = nativeComponent<
  { value: boolean; disabled: boolean; label: string },
  { change: { value: boolean } }
>('vela.switch', {
  props: ['value', 'disabled', 'label'],
  events: ['change'],
});

export function Switch(props: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <NativeSwitch
      testID={props.testID}
      value={props.value}
      disabled={props.disabled ?? false}
      label={props.label}
      accessibilityLabel={props.label}
      onChange={(event) => props.onChange(event.value)}
    />
  );
}
