/** Native iOS controls: SF Symbols, UISwitch and UISegmentedControl. */
import { colorScheme } from "nsh/device";
import { nativeComponent } from "nsh/native";
import { nativeColor, symbol, type NativeColor } from "./tokens";

const NativeSymbol = nativeComponent<{ name: string; size: number; weight: string; tint: string }>("vela/symbol", {
  props: ["name", "size", "weight", "tint"],
});

const NativeSwitch = nativeComponent<{ value: boolean; disabled: boolean; tint: string }, { change: { value: boolean } }>("vela/switch", {
  props: ["value", "disabled", "tint"],
  events: ["change"],
});

const NativeSegmented = nativeComponent<{ items: string[]; selected: number }, { change: { index: number } }>("vela/segmented", {
  props: ["items", "selected"],
  events: ["change"],
});

/** The hex of a role in the current appearance. */
export function resolve(color: NativeColor): string {
  return colorScheme() === "dark" ? nativeColor[color].dark : nativeColor[color].light;
}

/** An SF Symbol. Purely decorative unless `label` is set. */
export function Symbol(props: { name: string; size?: number; weight?: "regular" | "medium" | "semibold" | "bold"; color?: NativeColor; label?: string }) {
  const size = () => props.size ?? symbol.body;
  // The frame is the symbol's own size, rounded up to the 4pt grid, so a
  // symbol beside text adds no extra height to its row.
  const frame = () => Math.ceil((size() + 4) / 4) * 4;
  return <NativeSymbol
    name={props.name}
    size={size()}
    weight={props.weight ?? "regular"}
    tint={resolve(props.color ?? "accent")}
    style={{ width: frame(), height: frame() }}
    accessibilityElementsHidden={!props.label}
    accessibilityLabel={props.label}
  />;
}

/** A native switch. The row around it says what it does. */
export function Toggle(props: { value: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <NativeSwitch
    value={props.value}
    disabled={props.disabled ?? false}
    tint={resolve("accent")}
    role="switch"
    accessibilityLabel={props.label}
    onChange={(event) => props.onChange(event.value)}
  />;
}

/** A native segmented control. */
export function Segmented(props: { items: readonly string[]; selected: number; onChange: (index: number) => void }) {
  return <NativeSegmented
    items={[...props.items]}
    selected={props.selected}
    style={{ height: 28, alignSelf: "stretch" }}
    onChange={(event) => props.onChange(event.index)}
  />;
}
