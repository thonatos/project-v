/** Sheets opened from the devices pane: add a remote device, rename this Mac. */
import { View } from 'nsh';
import { List } from 'nsh/list';
import { store } from '../../core/store';
import type { TailnetDevice } from '../../../../shared/ui/protocol';
import {
  Badge,
  Button,
  edges,
  FormSheet,
  FormSheetDialog,
  Label,
  ListEmpty,
  ListRow,
  spacing,
  surfaces,
  TextField,
} from '../../ui';

export function AddDeviceSheet() {
  const busy = () => store.addDevice.busy();
  const close = () => {
    if (!busy()) store.addDevice.open.set(false);
  };
  const canSubmit = () => !busy() && Boolean(store.addDevice.name().trim() || store.addDevice.selection());
  return (
    <FormSheetDialog open={store.addDevice.open()} width={392} height={520} onClose={close}>
      <FormSheet
        title="添加设备"
        description="从当前 Tailnet 选择设备，或手动输入私人名称。Vela 会在保存前验证对方。"
        actions={
          <>
            <Button title="取消" variant="plain" disabled={busy()} onPress={close} />
            <Button
              title={busy() ? '正在验证…' : '验证并添加'}
              disabled={!canSubmit()}
              onPress={store.remotes.submit}
            />
          </>
        }
      >
        <View class={`min-h-0 flex-1 ${spacing.sectionGap}`}>
          <Label>Tailnet 设备</Label>
          {/* Card's frame, but flexible: the native list needs a bounded height to scroll in. */}
          <View class={`min-h-0 flex-1 overflow-hidden rounded-panel ${edges.all} ${surfaces.surface}`}>
            <List
              each={store.tailnetCandidates()}
              style={{ flex: 1 }}
              keyExtractor={(device) => device.dnsName ?? device.name}
              empty={<ListEmpty title={store.addDevice.loading() ? '正在读取 Tailnet 设备…' : '未发现 Tailnet 设备'} />}
            >
              {(device) => <TailnetRow device={device} />}
            </List>
          </View>
        </View>
        <TextField
          label="或输入私人名称"
          mono
          value={store.addDevice.name()}
          onChange={(value) => {
            store.addDevice.name.set(value);
            store.addDevice.selection.set('');
          }}
          onSubmit={store.remotes.submit}
          placeholder="例如 home-mac.example.ts.net"
          disabled={busy()}
          error={store.addDevice.error()}
        />
      </FormSheet>
    </FormSheetDialog>
  );
}

/** A recycled list cell: reads its device through the getter so reuse updates it. */
function TailnetRow(props: { device: () => TailnetDevice }) {
  const name = () => props.device().dnsName ?? '';
  const saved = () => store.devices().some((item) => item.privateName === name());
  const selectable = () => Boolean(name()) && !saved();
  const badge = () => {
    if (saved()) return <Badge status="stopped">已添加</Badge>;
    return props.device().online ? <Badge status="connected">在线</Badge> : <Badge status="offline">离线</Badge>;
  };
  return (
    <ListRow
      title={props.device().name || name()}
      description={name() || '没有 MagicDNS 名称'}
      mono={Boolean(name())}
      badge={badge()}
      onPress={() => {
        if (selectable()) store.remotes.choose(name());
      }}
      disabled={!selectable()}
      selected={store.addDevice.selection() === name() && selectable()}
    />
  );
}

export function RenameDeviceSheet() {
  return (
    <FormSheetDialog open={store.rename.open()} width={392} height={260} onClose={() => store.rename.open.set(false)}>
      <FormSheet
        title="设备名称"
        description="名称会同步到当前 Tailscale 节点。"
        actions={
          <>
            <Button title="取消" variant="plain" onPress={() => store.rename.open.set(false)} />
            <Button title="保存" onPress={store.account.saveRename} />
          </>
        }
      >
        <TextField
          label="Tailscale 注册名称"
          value={store.rename.draft()}
          onChange={(value) => store.rename.draft.set(value)}
          onSubmit={store.account.saveRename}
          error={store.rename.error()}
        />
      </FormSheet>
    </FormSheetDialog>
  );
}
