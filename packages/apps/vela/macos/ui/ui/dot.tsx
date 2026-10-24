/** A compact connection mark for list rows; the row's text still says the state. */
import { View } from 'nsh';
import { fills } from './tokens';

export type DotTone = 'success' | 'warning' | 'danger' | 'offline';

const DOT_FILLS: Readonly<Record<DotTone, string>> = {
  success: fills.success,
  warning: fills.warning,
  danger: fills.danger,
  offline: fills.offline,
};

export function Dot(props: { tone: DotTone }) {
  return <View class={`h-2 w-2 rounded-full ${DOT_FILLS[props.tone]}`} accessibilityElementsHidden />;
}
