/**
 * Vela's signature element. Every other row states a condition in words; this
 * one draws the thing itself — a short rail from this Mac to the remote
 * service, continuous while traffic can flow and faded while it cannot.
 */
import { View } from "nsh";
import { fills } from "./tokens";

export type LinkPhase = "forwarding" | "connecting" | "stopped" | "failed";

const rail = {
  forwarding: fills.success,
  connecting: fills.warning,
  stopped: fills.offline,
  failed: fills.danger,
} as const;

const labels = { forwarding: "转发中", connecting: "正在连接", stopped: "已停止", failed: "转发失败" } as const;

export function LinkTrack(props: { phase: LinkPhase }) {
  const tone = () => rail[props.phase];
  const live = () => props.phase === "forwarding";
  return <View role="image" accessibilityLabel={labels[props.phase]} class="h-4 w-5 justify-center">
    <View class="flex-row items-center">
      <View class={`size-1.5 rounded-full ${tone()}`} />
      <View class={`h-0.5 flex-1 ${tone()}`} classList={{ "opacity-30": !live() }} />
      <View class={`size-1.5 rounded-full ${tone()}`} classList={{ "opacity-40": !live() }} />
    </View>
  </View>;
}
