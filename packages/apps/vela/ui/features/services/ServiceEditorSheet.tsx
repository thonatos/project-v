/** Add or edit one of this Mac's local services. */
import { Scroll, View } from "nsh";
import { store } from "../../core/store";
import { Button, Callout, Field, FormSheet, FormSheetDialog, RadioGroup, spacing, TextField } from "../../ui";
import { DSH_AUTH_LOG_PLACEHOLDER, dshAuthLogHint, presetOptions } from "../../../ui-shared/view-model.mjs";

export function ServiceEditorSheet() {
  const editing = () => store.editor.editing() !== "";
  const editingService = () => store.services().find((service) => service.id === store.editor.editing());
  const tcp = () => store.editor.protocol() === "tcp";
  const close = () => store.editor.open.set(false);
  return <FormSheetDialog
    open={store.editor.open()}
    width={392}
    height={600}
    onClose={close}
  >
    <FormSheet
      title={editing() ? "编辑服务" : "添加服务"}
      actions={<>
        <Button title="取消" variant="plain" onPress={close} />
        <Button title={editing() ? "保存更改" : "添加服务"} onPress={store.serviceEditor.save} />
      </>}
    >
      <Scroll scrollbar={false} class="min-h-0 flex-1">
        <View class={`w-full ${spacing.pageGap}`}>
          <If when={editing()} else={<>
            <Field label="Web 服务">
              <RadioGroup
                label="Web 服务"
                value={store.editor.preset()}
                options={presetOptions("web", store.services())}
                onChange={store.serviceEditor.applyPreset}
              />
            </Field>
            <Field label="TCP 服务">
              <RadioGroup
                label="TCP 服务"
                value={store.editor.preset()}
                options={presetOptions("tcp", store.services())}
                onChange={store.serviceEditor.applyPreset}
              />
            </Field>
          </>}>
            <Callout>{tcp() ? "TCP 服务，修改地址后会重新检查端口是否在监听" : "Web 服务，修改地址后会重新检查可用性"}</Callout>
          </If>
          <TextField
            label="名称"
            value={store.editor.name()}
            onChange={(value) => store.editor.name.set(value)}
            onSubmit={store.serviceEditor.save}
          />
          <TextField
            label={tcp() ? "Loopback 地址与端口" : "Loopback HTTP 地址"}
            mono
            value={store.editor.target()}
            onChange={(value) => store.editor.target.set(value)}
            onSubmit={store.serviceEditor.save}
            placeholder={tcp() ? "例如 127.0.0.1:6379" : "例如 http://127.0.0.1:3000/"}
            hint={tcp()
              ? "只接受 localhost、127.0.0.1 或 [::1]，Vela 不会建立连接来检查它，只检查端口是否在监听。"
              : "只接受 localhost、127.0.0.1 或 ::1 的 HTTP 地址。"}
            error={store.editor.error()}
          />
          <If when={store.editor.adapter() === "dsh"}>
            <TextField
              label="DSH 输出日志（可选）"
              mono
              value={store.editor.authLog()}
              onChange={(value) => store.editor.authLog.set(value)}
              onSubmit={store.serviceEditor.save}
              placeholder={DSH_AUTH_LOG_PLACEHOLDER}
              hint={dshAuthLogHint(store.editor.authLog(), editingService()?.authLog === store.editor.authLog().trim() ? editingService()?.authLink : undefined)}
            />
          </If>
        </View>
      </Scroll>
    </FormSheet>
  </FormSheetDialog>;
}
