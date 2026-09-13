window.__ModuleLoader__.load({
  id: '@implementsio/dsh-telegram',
  factory: (require) => {
    var module = { exports: {} };
    var _exports = module.exports;
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if ((from && typeof from === 'object') || typeof from === 'function') {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, {
              get: () => from[key],
              enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
            });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (
      (target = mod != null ? __create(__getProtoOf(mod)) : {}),
      __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule ? __defProp(target, 'default', { value: mod, enumerable: true }) : target,
        mod,
      )
    );
    var __toCommonJS = (mod) => __copyProps(__defProp({}, '__esModule', { value: true }), mod);

    // src/client.js
    var client_exports = {};
    __export(client_exports, {
      apply: () => apply,
      inject: () => inject,
    });
    module.exports = __toCommonJS(client_exports);
    var React = __toESM(require('react'), 1);

    // src/client-credentials.js
    function credentialError(action) {
      return new Error(
        action === 'read'
          ? '\u65E0\u6CD5\u8BFB\u53D6 Telegram \u51ED\u636E\u72B6\u6001'
          : '\u65E0\u6CD5\u4FDD\u5B58 Telegram Bot Token',
      );
    }
    function getCredentialsApi(ctx) {
      if (!ctx.remote?.credentials) throw credentialError('read');
      return ctx.remote.credentials;
    }
    async function readCredentialStatuses(credentialsApi, refs) {
      let response;
      try {
        response = await credentialsApi.describe(Object.values(refs));
      } catch {
        throw credentialError('read');
      }
      if (response?.ok !== true) throw credentialError('read');
      return Object.fromEntries(
        Object.entries(refs).map(([key, ref]) => [key, response.value?.[ref]?.configured ?? false]),
      );
    }
    async function writeCredential(credentialsApi, ref, value) {
      let response;
      try {
        response = await credentialsApi.set(ref, value);
      } catch {
        throw credentialError('write');
      }
      if (response?.ok !== true) throw credentialError('write');
    }
    async function saveTelegramSettings({ credentialsApi, scope, sourceEnabled, values, secrets, refs }) {
      if (sourceEnabled) await scope.set('enabled', false);
      for (const [field, value] of Object.entries(values)) {
        if (field !== 'enabled') await scope.set(field, value);
      }
      for (const [key, value] of Object.entries(secrets)) {
        if (value.trim()) await writeCredential(credentialsApi, refs[key], value.trim());
      }
      const credentials = await readCredentialStatuses(credentialsApi, refs);
      if (values.enabled && !credentials.botToken) {
        throw new Error('Bot Token \u5FC5\u987B\u6210\u529F\u4FDD\u5B58\u540E\u624D\u80FD\u542F\u7528 Telegram');
      }
      await scope.set('enabled', values.enabled);
      return credentials;
    }

    // src/client.js
    var h = React.createElement;
    var SETTINGS_NAMESPACE = 'dsh-telegram';
    var STYLE_ID = 'implementsio-dsh-telegram-settings';
    var PLUGIN_VERSION = '0.4.0';
    var inject = ['remote', 'remote.credentials', 'slots', 'settingsScope', 'workspaces'];
    var styles = `
.dsh-tg-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.dsh-tg-card:hover{border-color:var(--dsw-alias-label-dimmed)}.dsh-tg-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dsh-tg-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.dsh-tg-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsh-tg-head-text{flex-direction:column;flex:1 1 0%;gap:4px;min-width:0;display:flex}.dsh-tg-title{display:flex;align-items:center;gap:8px}.dsh-tg-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.dsh-tg-version{border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 6px;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:500;line-height:1.4}.dsh-tg-description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.dsh-tg-hint{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.dsh-tg-chevron{color:var(--dsw-alias-label-tertiary);flex:0 0 auto;transition:transform .16s}.dsh-tg-chevron[data-open=true]{transform:rotate(180deg)}
.dsh-tg-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
.dsh-tg-section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;padding:8px 0}.dsh-tg-section-title{grid-column:1/-1;margin:10px 0 2px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:600;line-height:1.5;text-transform:uppercase;letter-spacing:.04em}.dsh-tg-section-title:first-child{margin-top:0}
.dsh-tg-field{display:grid;align-content:start;gap:6px;padding:10px 0}.dsh-tg-field-wide{grid-column:1/-1}.dsh-tg-label{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:500;line-height:1.5}
.dsh-tg-required{margin-left:6px;color:var(--dsw-alias-state-error-primary);font-size:11px;font-weight:500}.dsh-tg-optional{margin-left:6px;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:400}
.dsh-tg-input,.dsh-tg-select{box-sizing:border-box;height:34px;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 12px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.5;outline:none}.dsh-tg-input::placeholder{color:var(--dsw-alias-label-dimmed)}.dsh-tg-select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--dsw-alias-label-tertiary) 50%),linear-gradient(135deg,var(--dsw-alias-label-tertiary) 50%,transparent 50%);background-position:calc(100% - 17px) 14px,calc(100% - 12px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:36px}.dsh-tg-input:focus,.dsh-tg-select:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px var(--dsw-alias-interactive-bg-hover-accent)}
.dsh-tg-switch-row{display:flex;grid-column:1/-1;align-items:center;justify-content:space-between;gap:16px;padding:12px 0}.dsh-tg-switch-copy{display:grid;gap:3px}.dsh-tg-switch{width:38px;height:22px;margin:0;accent-color:var(--dsw-alias-button-primary-fill)}
.dsh-tg-footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.dsh-tg-feedback{min-width:0;flex:1 1 0%;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.dsh-tg-error{color:var(--dsw-alias-label-error,var(--dsw-alias-state-error-primary))}
.dsh-tg-button{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.dsh-tg-button-secondary{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.dsh-tg-button-secondary:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.dsh-tg-button-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.dsh-tg-button:disabled{opacity:.4;cursor:default}.dsh-tg-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@media(max-width:680px){.dsh-tg-section{grid-template-columns:1fr}.dsh-tg-field-wide{grid-column:auto}}
`;
    function Chevron({ open }) {
      return h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 14 14',
          fill: 'none',
          className: 'dsh-tg-chevron',
          'data-open': open,
          'aria-hidden': true,
        },
        h('path', {
          d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z',
          fill: 'currentColor',
        }),
      );
    }
    function Field({
      id,
      label,
      hint,
      type = 'text',
      value,
      wide = false,
      required = false,
      optional = false,
      placeholder,
      onChange,
    }) {
      return h(
        'div',
        { className: `dsh-tg-field${wide ? ' dsh-tg-field-wide' : ''}` },
        h(
          'label',
          { className: 'dsh-tg-label', htmlFor: id },
          label,
          required ? h('span', { className: 'dsh-tg-required' }, '\u5FC5\u586B') : null,
          optional ? h('span', { className: 'dsh-tg-optional' }, '\u53EF\u9009') : null,
        ),
        h('input', {
          id,
          className: 'dsh-tg-input',
          type,
          inputMode: type === 'number' ? 'numeric' : void 0,
          autoComplete: type === 'password' ? 'new-password' : void 0,
          placeholder,
          value: value ?? '',
          onChange: (event) => onChange(event.target.value),
        }),
        hint ? h('p', { className: 'dsh-tg-hint' }, hint) : null,
      );
    }
    function TelegramSettingsCard({ credentialsApi, scope, workspaceList }) {
      const snapshot = React.useSyncExternalStore(
        scope.subscribe.bind(scope),
        scope.getSnapshot.bind(scope),
        scope.getSnapshot.bind(scope),
      );
      const workspaceSnapshot = React.useSyncExternalStore(
        workspaceList.subscribe.bind(workspaceList),
        workspaceList.getSnapshot.bind(workspaceList),
        workspaceList.getSnapshot.bind(workspaceList),
      );
      const source = snapshot.value ?? {};
      const [open, setOpen] = React.useState(false);
      const [draft, setDraft] = React.useState(source);
      const [saving, setSaving] = React.useState(false);
      const [feedback, setFeedback] = React.useState('');
      const [error, setError] = React.useState('');
      const [secrets, setSecrets] = React.useState({ botToken: '' });
      const [credentials, setCredentials] = React.useState({ botToken: false });
      const [proxyOpen, setProxyOpen] = React.useState(Boolean(source.proxy?.ip || source.proxy?.port));
      const prefix = React.useId();
      React.useEffect(() => setDraft(source), [snapshot.revision]);
      const refs = {
        botToken: 'DSH_TELEGRAM_BOT_TOKEN',
      };
      const refreshCredentials = async () => {
        const next = await readCredentialStatuses(credentialsApi, refs);
        setCredentials(next);
        return next;
      };
      React.useEffect(() => {
        refreshCredentials().catch((caught) =>
          setError(caught?.message ?? '\u65E0\u6CD5\u8BFB\u53D6 Telegram \u51ED\u636E\u72B6\u6001'),
        );
      }, [snapshot.revision]);
      const dirty = JSON.stringify(draft) !== JSON.stringify(source);
      const secretDirty = Object.values(secrets).some(Boolean);
      const requiredMissing =
        Boolean(draft.enabled) &&
        (!draft.workspaceId?.trim() ||
          !/^[1-9]\d{0,15}$/.test(String(draft.ownerUserId ?? '').trim()) ||
          (!credentials.botToken && !secrets.botToken.trim()) ||
          (proxyOpen &&
            (!draft.proxy?.ip?.trim() ||
              !Number.isSafeInteger(Number(draft.proxy?.port)) ||
              Number(draft.proxy?.port) < 1 ||
              Number(draft.proxy?.port) > 65535)));
      const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
      const updateProxy = (field, value) =>
        setDraft((current) => ({
          ...current,
          proxy: { ...current.proxy, [field]: value },
        }));
      const discard = () => {
        setDraft(source);
        setProxyOpen(Boolean(source.proxy?.ip || source.proxy?.port));
        setFeedback('');
        setError('');
        setSecrets({ botToken: '' });
      };
      const save = async () => {
        setSaving(true);
        setFeedback('');
        setError('');
        try {
          const values = {
            enabled: Boolean(draft.enabled),
            workspaceId: draft.workspaceId ?? '',
            ownerUserId: draft.ownerUserId ?? '',
            messageLimit: Number(draft.messageLimit),
            proxy: { ...draft.proxy, port: Number(draft.proxy?.port ?? 0) },
          };
          const nextCredentials = await saveTelegramSettings({
            credentialsApi,
            scope,
            sourceEnabled: Boolean(source.enabled),
            values,
            secrets,
            refs,
          });
          setCredentials(nextCredentials);
          setSecrets({ botToken: '' });
          setFeedback('\u5DF2\u4FDD\u5B58');
        } catch (caught) {
          setError(caught?.message ?? 'Telegram \u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25');
        } finally {
          setSaving(false);
        }
      };
      return h(
        'li',
        { className: `dsh-tg-card${open ? ' dsh-tg-card-open' : ''}`, 'data-slot': 'telegram-settings-card' },
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-tg-header',
            'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          },
          h(
            'span',
            { className: 'dsh-tg-head-text' },
            h(
              'span',
              { className: 'dsh-tg-title' },
              h('span', { className: 'dsh-tg-name' }, 'Telegram'),
              h(
                'span',
                { className: 'dsh-tg-version', 'aria-label': `\u63D2\u4EF6\u7248\u672C ${PLUGIN_VERSION}` },
                `v${PLUGIN_VERSION}`,
              ),
            ),
            h(
              'span',
              { className: 'dsh-tg-description' },
              '\u901A\u8FC7 Telegram Bot API \u5C06\u79C1\u804A\u6D88\u606F\u8FDE\u63A5\u5230 Harness Workspace\u3002',
            ),
          ),
          h(Chevron, { open }),
        ),
        open
          ? h(
              'div',
              { className: 'dsh-tg-body' },
              snapshot.status !== 'ready'
                ? h('p', { className: 'dsh-tg-hint' }, '\u6B63\u5728\u8BFB\u53D6 Telegram \u8BBE\u7F6E\u2026')
                : h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { className: 'dsh-tg-section' },
                      h(
                        'div',
                        { className: 'dsh-tg-switch-row' },
                        h(
                          'span',
                          { className: 'dsh-tg-switch-copy' },
                          h('span', { className: 'dsh-tg-label' }, '\u542F\u7528 Telegram'),
                          h(
                            'span',
                            { className: 'dsh-tg-hint' },
                            '\u4FDD\u5B58\u540E\u91CD\u5EFA Telegram \u8FDE\u63A5\u3002',
                          ),
                        ),
                        h('input', {
                          type: 'checkbox',
                          className: 'dsh-tg-switch',
                          checked: Boolean(draft.enabled),
                          onChange: (event) => update('enabled', event.target.checked),
                        }),
                      ),
                      h('h4', { className: 'dsh-tg-section-title' }, '\u8FDE\u63A5\u51ED\u636E'),
                      h(Field, {
                        id: `${prefix}-token`,
                        label: 'Bot Token',
                        required: true,
                        type: 'password',
                        value: secrets.botToken,
                        wide: true,
                        placeholder: credentials.botToken
                          ? '\u5DF2\u914D\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8'
                          : '\u4ECE @BotFather \u83B7\u53D6',
                        hint: credentials.botToken
                          ? '\u51ED\u636E\u5DF2\u5B89\u5168\u4FDD\u5B58\u3002\u8F93\u5165\u65B0\u503C\u53EF\u66FF\u6362\u3002'
                          : '\u8FD0\u884C Telegram Bot \u5FC5\u9700\u3002',
                        onChange: (value) => setSecrets((current) => ({ ...current, botToken: value })),
                      }),
                      h('h4', { className: 'dsh-tg-section-title' }, '\u6D88\u606F\u8DEF\u7531'),
                      h(
                        'div',
                        { className: 'dsh-tg-field dsh-tg-field-wide' },
                        h(
                          'label',
                          { className: 'dsh-tg-label', htmlFor: `${prefix}-workspace` },
                          'Workspace',
                          h('span', { className: 'dsh-tg-required' }, '\u5FC5\u586B'),
                        ),
                        h(
                          'select',
                          {
                            id: `${prefix}-workspace`,
                            className: 'dsh-tg-select',
                            value: draft.workspaceId ?? '',
                            onChange: (event) => update('workspaceId', event.target.value),
                          },
                          h(
                            'option',
                            { value: '' },
                            workspaceSnapshot.state === 'loading'
                              ? '\u6B63\u5728\u8BFB\u53D6 Workspace\u2026'
                              : '\u8BF7\u9009\u62E9 Workspace',
                          ),
                          ...(workspaceSnapshot.items ?? []).map((workspace) =>
                            h(
                              'option',
                              { key: workspace.workspaceId, value: workspace.workspaceId },
                              workspace.name ?? workspace.path ?? workspace.workspaceId,
                            ),
                          ),
                        ),
                        h(
                          'p',
                          { className: 'dsh-tg-hint' },
                          'Telegram \u5BF9\u8BDD\u4F1A\u5728\u6B64 Workspace \u4E2D\u521B\u5EFA Harness Session\u3002',
                        ),
                      ),
                      h(Field, {
                        id: `${prefix}-owner`,
                        label: 'Owner User ID',
                        required: true,
                        value: draft.ownerUserId,
                        wide: true,
                        hint: '\u4EC5\u63A5\u53D7\u8BE5\u7528\u6237\u7684\u79C1\u804A\uFF0C\u586B\u5199\u6570\u5B57 User ID\u3002',
                        onChange: (value) => update('ownerUserId', value),
                      }),
                      h('h4', { className: 'dsh-tg-section-title' }, '\u6D88\u606F\u8BBE\u7F6E'),
                      h(Field, {
                        id: `${prefix}-limit`,
                        label: '\u6D88\u606F\u957F\u5EA6\u4E0A\u9650',
                        optional: true,
                        type: 'number',
                        value: draft.messageLimit,
                        hint: '\u9ED8\u8BA4 4096\uFF0C\u901A\u5E38\u65E0\u9700\u4FEE\u6539\u3002',
                        onChange: (value) => update('messageLimit', value),
                      }),
                      h('h4', { className: 'dsh-tg-section-title' }, '\u4EE3\u7406'),
                      h(
                        'div',
                        { className: 'dsh-tg-switch-row' },
                        h(
                          'span',
                          { className: 'dsh-tg-switch-copy' },
                          h(
                            'span',
                            { className: 'dsh-tg-label' },
                            '\u4F7F\u7528\u4EE3\u7406',
                            h('span', { className: 'dsh-tg-optional' }, '\u53EF\u9009'),
                          ),
                          h(
                            'span',
                            { className: 'dsh-tg-hint' },
                            '\u76F4\u8FDE Telegram \u4E0D\u53EF\u7528\u65F6\u518D\u5F00\u542F\u3002',
                          ),
                        ),
                        h('input', {
                          type: 'checkbox',
                          className: 'dsh-tg-switch',
                          checked: proxyOpen,
                          onChange: (event) => {
                            setProxyOpen(event.target.checked);
                            if (!event.target.checked)
                              setDraft((current) => ({
                                ...current,
                                proxy: { type: 'socks5', ip: '', port: 0, username: '', password: '' },
                              }));
                          },
                        }),
                      ),
                      proxyOpen
                        ? h(
                            React.Fragment,
                            null,
                            h(
                              'div',
                              { className: 'dsh-tg-field' },
                              h(
                                'label',
                                { className: 'dsh-tg-label', htmlFor: `${prefix}-proxy-type` },
                                '\u4EE3\u7406\u534F\u8BAE',
                                h('span', { className: 'dsh-tg-required' }, '\u5FC5\u586B'),
                              ),
                              h(
                                'select',
                                {
                                  id: `${prefix}-proxy-type`,
                                  className: 'dsh-tg-select',
                                  value: draft.proxy?.type ?? 'socks5',
                                  onChange: (event) => updateProxy('type', event.target.value),
                                },
                                h('option', { value: 'socks5' }, 'SOCKS5'),
                                h('option', { value: 'http' }, 'HTTP'),
                                h('option', { value: 'https' }, 'HTTPS'),
                              ),
                            ),
                            h(Field, {
                              id: `${prefix}-proxy-ip`,
                              label: '\u4EE3\u7406\u5730\u5740',
                              required: true,
                              value: draft.proxy?.ip,
                              onChange: (value) => updateProxy('ip', value),
                            }),
                            h(Field, {
                              id: `${prefix}-proxy-port`,
                              label: '\u4EE3\u7406\u7AEF\u53E3',
                              required: true,
                              type: 'number',
                              value: draft.proxy?.port,
                              onChange: (value) => updateProxy('port', value),
                            }),
                            h(Field, {
                              id: `${prefix}-proxy-user`,
                              label: '\u4EE3\u7406\u7528\u6237\u540D',
                              optional: true,
                              value: draft.proxy?.username,
                              onChange: (value) => updateProxy('username', value),
                            }),
                            h(Field, {
                              id: `${prefix}-proxy-password`,
                              label: '\u4EE3\u7406\u5BC6\u7801',
                              optional: true,
                              type: 'password',
                              value: draft.proxy?.password,
                              onChange: (value) => updateProxy('password', value),
                            }),
                          )
                        : null,
                    ),
                    h(
                      'div',
                      { className: 'dsh-tg-footer' },
                      feedback ? h('span', { className: 'dsh-tg-feedback', role: 'status' }, feedback) : null,
                      error ? h('span', { className: 'dsh-tg-feedback dsh-tg-error', role: 'alert' }, error) : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-tg-button dsh-tg-button-secondary',
                          disabled: (!dirty && !secretDirty) || saving,
                          onClick: discard,
                        },
                        '\u653E\u5F03\u4FEE\u6539',
                      ),
                      requiredMissing
                        ? h(
                            'span',
                            { className: 'dsh-tg-feedback dsh-tg-error' },
                            '\u8BF7\u5148\u5B8C\u6210\u6240\u6709\u5FC5\u586B\u9879',
                          )
                        : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-tg-button dsh-tg-button-primary',
                          disabled: (!dirty && !secretDirty) || saving || requiredMissing || !snapshot.writable,
                          onClick: save,
                        },
                        h('span', null, saving ? '\u4FDD\u5B58\u4E2D\u2026' : '\u4FDD\u5B58'),
                      ),
                    ),
                  ),
            )
          : null,
      );
    }
    function apply(ctx) {
      ctx.effect(() => {
        const element = document.createElement('style');
        element.id = STYLE_ID;
        element.textContent = styles;
        document.head.append(element);
        return () => element.remove();
      });
      const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
      const credentialsApi = getCredentialsApi(ctx);
      const workspaces = ctx.get('workspaces');
      ctx.slots.inject('settings.plugin.item', () =>
        ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: SETTINGS_NAMESPACE,
            inject: () => ({ credentialsApi, scope, workspaceList: workspaces.list }),
          },
          TelegramSettingsCard,
        ),
      );
    }

    return module.exports;
  },
});
