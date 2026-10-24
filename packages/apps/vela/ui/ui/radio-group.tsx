/**
 * An always-visible single choice, following shadcn's RadioGroup contract: the
 * options stay on screen so the available choices are part of the form rather
 * than hidden behind a menu. Rows share `ListRow`'s frame inside a `Card`.
 */
import { Text, View } from "nsh";
import { Card } from "./card";
import { edges, fills, states, text, type } from "./tokens";

export interface RadioOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly detail?: string;
  readonly disabled?: boolean;
}

export function RadioGroup<Value extends string>(props: {
  value: Value;
  options: readonly RadioOption<Value>[];
  onChange: (value: Value) => void;
  label: string;
  testID?: string;
}) {
  return <Card testID={props.testID}>
    <View role="radiogroup" accessibilityLabel={props.label}>
      <Each of={props.options}>{(option) => {
        const checked = () => props.value === option().value;
        return <View
          onPress={() => { if (!option().disabled) props.onChange(option().value); }}
          disabled={option().disabled}
          role="radio"
          accessibilityLabel={option().label}
          accessibilityState={{ checked: checked(), disabled: option().disabled ?? false }}
          class={`min-h-[32px] flex-row items-center gap-3 px-4 py-1.5 first:border-t-0 ${edges.top} ${states.hover} ${states.disabled}`}
        >
          <View class={`size-3.5 items-center justify-center rounded-full border`} classList={{ [edges.accent]: checked(), [edges.line]: !checked() }}>
            <If when={checked()}><View class={`size-1.5 rounded-full ${fills.accent}`} /></If>
          </View>
          <Text numberOfLines={1} class={`min-w-0 flex-1 ${type.label} ${text.primary}`} classList={{ "font-semibold": checked() }}>{option().label}</Text>
          <If when={option().detail}><Text numberOfLines={1} class={`${type.mono} ${text.muted}`}>{option().detail}</Text></If>
        </View>;
      }}</Each>
    </View>
  </Card>;
}
