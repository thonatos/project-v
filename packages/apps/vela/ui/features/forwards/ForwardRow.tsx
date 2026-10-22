/**
 * One remote service as a forward: a switch that is the forward's state, and
 * once it is on, the endpoint block with the address and its two actions.
 * Device details and the forwards page both render this, so the two never
 * diverge.
 */
import { View } from "nsh";
import { store, type Forward } from "../../core/store";
import type { DeviceViewModel, ServiceViewModel } from "../../model";
import { Badge, Endpoint, EndpointActions, ListRow, Switch, spacing } from "../../ui";
import { connectionCommand, forwardEndpoint } from "../../view-model.mjs";

export function ForwardRow(props: {
  device: DeviceViewModel;
  service: ServiceViewModel;
  /** Shown under the address, e.g. the device name on the forwards page. */
  caption?: string;
}) {
  const forward = () => store.forwardFor(props.device, props.service.id);
  const on = () => forward() !== undefined;
  const live = () => forward()?.phase === "forwarding";
  const web = () => props.service.protocol !== "tcp";
  const url = () => forward()?.url ?? "";
  const address = () => {
    const { host, port } = forwardEndpoint(url());
    return host && port ? `${host}:${port}` : url();
  };
  const command = () => connectionCommand(props.service.preset, url());
  const unavailable = () => props.service.state === "unavailable";
  const message = () => {
    const current = forward();
    if (current?.phase === "connecting") return "正在建立链路…";
    if (current?.phase === "failed") return current.message || "转发失败";
    return "";
  };
  const toggle = (value: boolean) => {
    const current = forward();
    if (value) store.forwarding.request(props.device, props.service.id);
    else if (current) store.forwarding.stop(current);
  };
  const open = () => {
    const current = forward();
    if (current) store.forwarding.open(current);
  };
  return <ListRow
    testID={`forward-${props.device.id}-${props.service.id}`}
    title={props.service.name}
    badge={<If when={!on() && unavailable()}><Badge status="unavailable">不可用</Badge></If>}
    description={on() ? undefined : props.service.subtitle}
    trailing={<View class={`flex-row items-center ${spacing.inline}`}>
      <If when={live()}>
        <EndpointActions
          onOpen={web() ? open : undefined}
          onCopy={() => store.forwarding.copy(web() ? url() : command())}
          copyLabel={web() ? "复制地址" : `复制命令：${command()}`}
        />
      </If>
      <Switch value={on()} disabled={!on() && unavailable()} label={`转发 ${props.service.name}`} onChange={toggle} />
    </View>}
    footer={<If when={on()}>
      <Endpoint
        phase={forward()?.phase ?? "connecting"}
        address={address()}
        caption={props.caption}
        message={message()}
        onOpen={web() ? open : undefined}
        onRetry={() => store.forwarding.request(props.device, props.service.id)}
      />
    </If>}
  />;
}

/** The service definition a forward points at, or a stand-in if it vanished. */
export function forwardService(forward: Forward): ServiceViewModel {
  return forward.device.services.find((service) => service.id === forward.service)
    ?? { id: forward.service, name: forward.service, subtitle: "", protocol: forward.url?.startsWith("tcp://") ? "tcp" : "http", state: "available", shared: true };
}
