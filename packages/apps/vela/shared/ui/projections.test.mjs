import assert from 'node:assert/strict';
import {
  DSH_AUTH_LOG_PLACEHOLDER,
  SERVICE_PRESETS,
  dshAuthLogHint,
  presetFor,
  presetForService,
  presetOptions,
  protocolOf,
  serviceFormError,
  serviceStateLabel,
  serviceTargetURL,
  targetKey,
  targetLabel,
} from './services.ts';
import { connectionCommand, forwardEndpoint, shareWarning } from './forwarding.ts';
import { connectionLabel, deviceAddressLines, localServices, nextDeviceID, remoteDevices } from './devices.ts';
import {
  appearancePreference,
  diagnosticActivityRows,
  diagnosticSnapshot,
  diagnosticSummaryRows,
  remoteAddError,
} from './diagnostics.ts';
import { logLevelCounts, logRows } from './logs.ts';

const status = {
  network: 'connected',
  sharing: { enabled: true, opencode: true, dsh: false },
  services: [
    {
      id: 'opencode',
      name: 'OpenCode',
      protocol: 'http',
      url: 'http://127.0.0.1:49374/api/info',
      port: 47845,
      state: 'available',
      shared: true,
    },
    {
      id: 'dsh',
      name: 'DSH',
      url: 'http://127.0.0.1:3080/',
      port: 47846,
      adapter: 'dsh',
      state: 'unavailable',
      shared: false,
    },
    {
      id: 'redis',
      name: 'Redis',
      protocol: 'tcp',
      url: 'tcp://127.0.0.1:6379',
      port: 47850,
      state: 'available',
      shared: false,
    },
  ],
  remotes: [
    {
      name: 'Home',
      privateName: 'home.example.ts.net',
      connection: 'connected',
      compatible: true,
      services: [
        { id: 'docs', name: 'Docs', protocol: 'http', port: 47847, available: true },
        { id: 'ssh', name: 'SSH', protocol: 'tcp', port: 47851, available: true },
      ],
    },
    {
      name: 'Office',
      privateName: 'office.example.ts.net',
      connection: 'offline',
      compatible: true,
      issue: 'unauthorized',
      lastConnectedUtc: '2026-10-19T00:00:00Z',
    },
    { name: 'Old', privateName: 'old.example.ts.net', connection: 'offline', compatible: false, issue: 'incompatible' },
  ],
};

// Local services carry their protocol; a missing protocol migrates to HTTP.
{
  const local = localServices(status);
  assert.deepEqual(
    local.map(({ id, protocol, subtitle }) => ({ id, protocol, subtitle })),
    [
      { id: 'opencode', protocol: 'http', subtitle: 'http://127.0.0.1:49374/api/info' },
      { id: 'dsh', protocol: 'http', subtitle: 'http://127.0.0.1:3080/' },
      { id: 'redis', protocol: 'tcp', subtitle: '127.0.0.1:6379' },
    ],
  );
  assert.equal(protocolOf({}), 'http', 'a service without a protocol must be treated as HTTP');
  assert.equal(protocolOf({ protocol: 'udp' }), 'http', 'an unknown protocol must not be treated as TCP');
  assert.equal(targetLabel('tcp', 'tcp://[::1]:5432'), '[::1]:5432');
  assert.equal(targetLabel('http', 'http://127.0.0.1:8188/'), 'http://127.0.0.1:8188/');
  console.log('Vela local service protocol projection passed');
}

// Remote devices keep each service's protocol.
{
  const devices = remoteDevices(status.remotes);
  assert.equal(devices[0].services[0].protocol, 'http');
  assert.equal(devices[0].services[1].protocol, 'tcp');
  assert.equal(devices[0].services[1].subtitle, 'TCP 服务');
  assert.equal(devices[1].issue, 'unauthorized');
  assert.equal(devices[2].compatible, false);
  console.log('Vela remote device projection passed');
}

// Presets are grouped by protocol and include ComfyUI and the TCP services.
{
  const web = SERVICE_PRESETS.filter((preset) => preset.group === 'web').map((preset) => preset.label);
  const tcp = SERVICE_PRESETS.filter((preset) => preset.group === 'tcp').map((preset) => preset.label);
  assert.deepEqual(web, ['OpenCode', 'DSH', 'ComfyUI', '自定义 HTTP']);
  assert.deepEqual(tcp, ['SSH', 'Redis', 'MySQL', 'PostgreSQL', '自定义 TCP']);
  for (const preset of SERVICE_PRESETS) {
    assert.equal(
      preset.protocol,
      preset.group === 'tcp' ? 'tcp' : 'http',
      `${preset.label} must use its group's protocol`,
    );
  }
  assert.equal(presetFor('comfyui').url, 'http://127.0.0.1:8188/');
  assert.equal(
    presetFor('comfyui').adapter,
    '',
    'ComfyUI needs no adapter: Host and Origin already match after forwarding',
  );
  assert.equal(presetFor('mysql').url, 'tcp://127.0.0.1:3306');
  assert.equal(presetFor('redis').url, 'tcp://127.0.0.1:6379');
  assert.equal(presetFor('postgres').url, 'tcp://127.0.0.1:5432');
  assert.equal(presetFor('ssh').url, 'tcp://127.0.0.1:22');
  assert.equal(presetFor('missing').preset, 'custom-http');

  const services = localServices(status);
  const webOptions = presetOptions('web', services);
  assert.equal(
    webOptions.find((option) => option.value === 'opencode').disabled,
    true,
    "a service already pointing at OpenCode's loopback target must not be offered again",
  );
  assert.equal(
    webOptions.find((option) => option.value === 'dsh').disabled,
    true,
    'an already added DSH must not be offered again',
  );
  assert.equal(
    presetOptions('tcp', services).every((option) => !option.disabled),
    true,
    'TCP presets can be added more than once',
  );
  assert.equal(presetForService({ protocol: 'tcp' }), 'custom-tcp');
  assert.equal(presetForService({ adapter: 'dsh', protocol: 'http' }), 'dsh');
  assert.equal(
    presetForService({ protocol: 'http', url: 'http://127.0.0.1:49374/' }),
    'opencode',
    "a custom entry on OpenCode's target is recognised as OpenCode",
  );
  assert.equal(
    presetForService({ preset: 'ssh', name: 'Renamed shell', protocol: 'tcp' }),
    'ssh',
    'renaming a service must not lose its preset type',
  );
  assert.equal(
    targetKey('http', 'http://localhost:3080/x'),
    targetKey('http', 'http://127.0.0.1:3080/'),
    'localhost folds into 127.0.0.1',
  );
  assert.equal(targetKey('tcp', 'tcp://127.0.0.1:6379'), '127.0.0.1:6379');
  assert.equal(targetKey('http', 'http://127.0.0.1/'), '127.0.0.1:80', 'a missing HTTP port is 80');
  assert.equal(targetKey('http', 'not a url'), '', 'an unparseable target has no identity');
  console.log('Vela protocol-grouped presets passed');
}

// The form rejects non-loopback targets for both protocols before Core does.
{
  assert.equal(serviceFormError('tcp', 'Redis', '127.0.0.1:6379'), '');
  assert.equal(serviceFormError('tcp', 'Redis', 'tcp://localhost:6379'), '');
  assert.equal(serviceFormError('tcp', 'PG', '[::1]:5432'), '');
  assert.match(serviceFormError('tcp', 'Redis', '192.168.1.5:6379'), /loopback/);
  assert.match(serviceFormError('tcp', 'Redis', '127.0.0.1'), /loopback/);
  assert.match(serviceFormError('tcp', 'Redis', '127.0.0.1:70000'), /1–65535/);
  assert.match(serviceFormError('tcp', '', '127.0.0.1:1'), /名称/);
  assert.equal(serviceFormError('http', 'Docs', 'http://127.0.0.1:3000/'), '');
  assert.match(serviceFormError('http', 'Docs', 'http://10.0.0.2:3000/'), /localhost/);
  assert.match(serviceFormError('http', 'Docs', 'https://127.0.0.1/'), /localhost/);
  assert.equal(serviceTargetURL('tcp', ' 127.0.0.1:6379 '), 'tcp://127.0.0.1:6379');
  assert.equal(serviceTargetURL('tcp', 'tcp://127.0.0.1:6379'), 'tcp://127.0.0.1:6379');
  assert.equal(serviceTargetURL('http', 'http://127.0.0.1:3000/'), 'http://127.0.0.1:3000/');
  console.log('Vela service form validation passed');
}

// TCP forwards surface a command instead of a page.
{
  assert.deepEqual(forwardEndpoint('tcp://ssh-home.localhost:47901'), {
    protocol: 'tcp',
    host: 'ssh-home.localhost',
    port: 47901,
  });
  assert.equal(forwardEndpoint('http://opencode-home.localhost:47850/').protocol, 'http');
  assert.equal(connectionCommand('ssh', 'tcp://ssh-home.localhost:47901'), 'ssh -p 47901 <user>@ssh-home.localhost');
  assert.equal(
    connectionCommand('redis', 'tcp://redis-home.localhost:47902'),
    'redis-cli -h redis-home.localhost -p 47902',
  );
  assert.equal(
    connectionCommand('postgres', 'tcp://postgresql-home.localhost:47903'),
    'psql -h postgresql-home.localhost -p 47903 -U <user>',
  );
  const mysql = connectionCommand('mysql', 'tcp://mysql-home.localhost:47904');
  assert.match(
    mysql,
    /-h 127\.0\.0\.1 -P 47904/,
    'mysql treats localhost-style names as a Unix socket, so it must get 127.0.0.1',
  );
  assert.equal(connectionCommand(undefined, 'tcp://custom-home.localhost:47905'), 'custom-home.localhost:47905');
  assert.equal(
    connectionCommand(undefined, 'http://docs-home.localhost:47906/'),
    '',
    'HTTP forwards have no connection command',
  );
  assert.equal(connectionCommand('ssh', 'tcp://'), '', 'a target without host and port has no command');
  assert.equal(
    connectionCommand('ssh', 'tcp://renamed-home.localhost:47907'),
    'ssh -p 47907 <user>@renamed-home.localhost',
    'renaming SSH must not change its client command',
  );
  console.log('Vela TCP connection commands passed');
}

// Sharing a shell is announced more strongly than sharing a page.
{
  const ssh = shareWarning({ name: 'Renamed shell', protocol: 'tcp', preset: 'ssh' });
  assert.match(ssh.message, /命令行/);
  assert.match(ssh.message, /远程登录/, 'the SSH warning must say that Remote Login must be on');
  assert.match(shareWarning({ name: 'Renamed cache', protocol: 'tcp', preset: 'redis' }).title, /TCP/);
  assert.match(shareWarning({ name: 'OpenCode', protocol: 'http' }).message, /运行命令/);
  console.log('Vela share warnings passed');
}

// Diagnostics stay redacted.
{
  const diagnostic = diagnosticSnapshot(
    { ...status, authUrl: 'https://login.example/secret', cookie: 'sensitive', prompt: 'private' },
    '2',
  );
  assert.match(diagnostic, /"redacted":true/);
  for (const secret of ['login.example', 'sensitive', 'private', 'privateName', 'home.example.ts.net', '127.0.0.1']) {
    assert.doesNotMatch(diagnostic, new RegExp(secret.replace(/\./g, '\\.')));
  }
  assert.match(diagnostic, /"protocol":"tcp"/, 'the snapshot must say which services are TCP');
  console.log('Vela diagnostics redaction passed');
}

// Labels: status is said in words, and TCP availability names what was checked.
{
  assert.deepEqual(['connected', 'connecting', 'offline', 'needs-auth'].map(connectionLabel), [
    '在线',
    '连接中',
    '离线',
    '需要连接',
  ]);
  assert.equal(serviceStateLabel({ state: 'available', protocol: 'http' }), '可用');
  assert.equal(serviceStateLabel({ state: 'checking', protocol: 'tcp' }), '检查中');
  assert.equal(serviceStateLabel({ state: 'unavailable', protocol: 'tcp' }), '未在监听');
  assert.equal(serviceStateLabel({ state: 'unavailable', protocol: 'http' }), '不可用');
  console.log('Vela status labels passed');
}

// Device addresses list IPv4 before IPv6, one per line.
{
  assert.deepEqual(deviceAddressLines(['fd7a::1', '100.1.2.3']), ['100.1.2.3', 'fd7a::1']);
  assert.deepEqual(deviceAddressLines(undefined), []);
  console.log('Vela device address lines passed');
}

// Keyboard selection and remote errors.
{
  assert.equal(nextDeviceID('this-mac', ['home', 'office'], 1), 'home');
  assert.equal(nextDeviceID('this-mac', ['home', 'office'], -1), 'office');
  assert.equal(nextDeviceID('office', ['home', 'office'], 1), 'this-mac', 'selection must wrap to this Mac');
  assert.equal(nextDeviceID('missing', ['home'], 1), 'this-mac');
  assert.equal(remoteAddError('remote Vela protocol is incompatible'), '两台 Mac 的 Vela 版本不兼容。');
  assert.equal(remoteAddError('remote Mac rejected this device'), '另一台设备拒绝了访问。');
  assert.equal(remoteAddError('invalid private Mac name'), '私人名称格式无效。');
  assert.equal(remoteAddError('remote Mac is offline'), '无法连接到这台 Mac。请确认它在线并运行 Vela。');
  console.log('Vela keyboard selection and remote errors passed');
}

// DSH's sign-in log is configured on the sharing Mac; the hint reports what Core read.
{
  assert.match(dshAuthLogHint('', undefined), /可选/);
  assert.match(dshAuthLogHint('~/.dsh/logs/web.log', 'ready'), /自动登录/);
  assert.match(dshAuthLogHint('~/.dsh/logs/web.log', 'missing'), /启动地址/);
  assert.match(dshAuthLogHint('~/.dsh/logs/web.log', 'unreadable'), /无法读取/);
  assert.match(dshAuthLogHint('~/.dsh/logs/web.log', undefined), /保存后/);
  console.log('Vela DSH sign-in log hints passed');
}

// Appearance and activity.
{
  assert.equal(appearancePreference(null), 'system');
  assert.equal(
    appearancePreference({ preferences: { appearance: 'sepia' } }),
    'system',
    'unsupported appearances must fall back to system',
  );
  assert.equal(appearancePreference({ preferences: { appearance: 'dark' } }), 'dark');
  const rows = diagnosticActivityRows({
    mappings: [
      {
        device: 'Mac mini',
        privateName: 'macmini.example.ts.net',
        service: 'redis',
        url: 'tcp://redis-macmini.localhost:47902',
        connections: 2,
      },
    ],
    published: {},
  });
  assert.equal(rows[0].key, 'macmini.example.ts.net/redis');
  assert.match(rows[0].detail, /^redis-macmini\.localhost:47902 · 2 个活跃连接$/);
  assert.deepEqual(diagnosticActivityRows(null), []);
  console.log('Vela appearance and activity projections passed');
}

// Logs read like logs: local time column, normalised level, message as subject.
{
  const at = '2026-10-21T00:00:05Z';
  const local = new Date(at);
  const pad = (value) => String(value).padStart(2, '0');
  const time = `${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
  const logs = {
    entries: [
      { atUtc: '2026-10-21T00:00:00Z', level: 'info', area: 'mapping', message: 'opened macmini/opencode' },
      { atUtc: at, level: 'error', area: 'proxy', message: 'connection refused' },
      { atUtc: '2026-10-21T00:00:09Z', level: 'WARNING', area: 'service', message: 'dsh is unavailable' },
      { atUtc: 'not-a-time', level: 'debug', area: 'x', message: 'y' },
    ],
  };
  const rows = logRows(logs);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].level, 'info', 'an unknown level must render as information');
  assert.equal(rows[0].time, '--:--:--', 'an unparseable instant must still keep the column aligned');
  assert.equal(rows[1].level, 'warn', 'WARNING must normalise to warn');
  assert.equal(rows[1].levelLabel, 'WARN');
  assert.equal(rows[2].message, 'connection refused', 'the message must be the subject, not folded into a detail line');
  assert.equal(rows[2].area, 'proxy');
  assert.equal(rows[2].time, time, 'time must be the local wall clock, not the raw RFC 3339 string');
  assert.match(rows[2].time, /^\d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(
    logRows(logs, 'error').map((row) => row.message),
    ['connection refused'],
  );
  assert.deepEqual(logLevelCounts(logs), { all: 4, error: 1, warn: 1, info: 2 });
  assert.deepEqual(logRows(null), []);
  console.log('Vela log projection passed');
}

// The settings summary shows what would be copied.
{
  const summary = {
    ...status,
    deviceName: 'Studio',
    tailscale: {
      name: 'studio',
      dnsName: 'studio.example.ts.net',
      ips: ['100.1.2.3'],
      online: true,
      tailnet: 'example.ts.net',
      user: 'me',
    },
    tailnetDevices: [],
  };
  const rows = diagnosticSummaryRows(summary, '2');
  assert.deepEqual(
    rows.map((row) => row.key),
    ['protocol', 'network', 'sharing', 'remotes'],
  );
  assert.equal(rows[0].title, '协议 v2');
  assert.match(rows[0].detail, /example\.ts\.net/);
  assert.equal(rows[1].detail, '在线');
  assert.match(rows[2].detail, /1\/3 个服务已共享/);
  assert.match(rows[2].detail, /1 个不可用/);
  assert.match(rows[3].detail, /1\/3 台在线/);
  assert.match(rows[3].detail, /1 台需要更新/);
  const empty = diagnosticSummaryRows(null, '2');
  assert.equal(empty.length, 1);
  assert.match(empty[0].detail, /等待 Core/);
  assert.ok(!diagnosticSnapshot(summary, '2').includes('100.1.2.3'), 'the copied snapshot must not include addresses');
  console.log('Vela diagnostic summary projection passed');
}
