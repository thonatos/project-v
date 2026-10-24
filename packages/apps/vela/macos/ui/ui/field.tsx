/** Form fields: a label, the control, and either a hint or an error below it. */
import { Input, Text, View, type JSX } from 'nsh';
import { Callout } from './alert';
import { edges, spacing, states, surfaces, text, type } from './tokens';

export function Label(props: { children: string }) {
  return <Text class={`${type.sectionTitle} ${text.muted}`}>{props.children}</Text>;
}

export function Field(props: { label: string; hint?: string; error?: string; children?: JSX.Element }) {
  return (
    <View class={spacing.sectionGap}>
      <Label>{props.label}</Label>
      {props.children}
      <If when={props.error} else={props.hint ? <Callout>{props.hint}</Callout> : null}>
        <Text role="alert" class={`${type.caption} ${text.danger}`}>
          {props.error}
        </Text>
      </If>
    </View>
  );
}

export function TextInput(props: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <Input
      value={props.value}
      onChange={props.onChange}
      onSubmit={props.onSubmit}
      placeholder={props.placeholder}
      readonly={Boolean(props.disabled)}
      autoCapitalize="none"
      autoCorrect={false}
      class={`h-7 rounded-control px-2 ${type.body} ${props.mono ? 'font-mono' : ''} ${edges.all} ${surfaces.surface} ${states.focus} ${states.disabled} ${states.placeholder}`}
    />
  );
}

export function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  mono?: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <Field label={props.label} hint={props.hint} error={props.error}>
      <TextInput
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        mono={props.mono}
        onChange={props.onChange}
        onSubmit={props.onSubmit}
      />
    </Field>
  );
}
