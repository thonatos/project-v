/** Add or edit one of this Mac's local services. */
import { Scroll, View } from "nsh";
import { Modal } from "nsh/ui/mobile";
import { store } from "../../core/store";
import { Button, Callout, Field, FormSheet, RadioGroup, spacing, TextField } from "../../ui";
import { presetOptions } from "../../view-model.mjs";

export function ServiceEditorSheet() {
  const editing = () => store.editor.editing() !== "";
  const tcp = () => store.editor.protocol() === "tcp";
  const close = () => store.editor.open.set(false);
  return <Modal
    visible={store.editor.open()}
    dismissible
    onRequestClose={close}
    desktop={{ presentationStyle: "formSheet" }}
    style={{ width: 420, height: 600 }}
  >
    <FormSheet
      title={editing() ? "编辑服务" : "添加服务"}
      actions={<>
        <Button title="取消" variant="plain" onPress={close} />
        <Button title={editing() ? "保存更改" : "添加服务"} onPress={store.serviceEditor.save} />
      </>}
    >
      <Scroll showsIndicator={false} class="min-h-0 flex-1">
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
        </View>
      </Scroll>
    </FormSheet>
  </Modal>;
}
