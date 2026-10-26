/**
 * One-of-N choice across the row's width: the desktop counterpart of the iOS
 * segmented control. Options stay visible so the available choices are part of
 * the form, and each one is a focus stop with a single selected state.
 */
import { Text, View } from 'nsh';
import { Tab, Tabs } from 'nsh/base';
import { fills, geometry, surfaces, text, type } from './tokens';

export interface SegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export function Segmented<Value extends string>(props: {
  value: Value;
  options: readonly SegmentedOption<Value>[];
  onChange: (value: Value) => void;
  label: string;
  testID?: string;
}) {
  return (
    <Tabs class={`flex-row gap-1 rounded-control border p-1 ${surfaces.well}`} testID={props.testID}>
      <Each of={props.options}>
        {(option) => {
          const selected = () => props.value === option().value;
          return (
            <Tab
              onPress={() => props.onChange(option().value)}
              selected={selected()}
              accessibilityLabel={option().label}
              class={`${geometry.compactControl} flex-1 items-center justify-center rounded-control px-2 active:opacity-75 ${selected() ? fills.accent : ''}`}
            >
              <Text class={`${type.label} font-medium ${selected() ? text.onAccent : text.muted}`}>
                {option().label}
              </Text>
            </Tab>
          );
        }}
      </Each>
    </Tabs>
  );
}
