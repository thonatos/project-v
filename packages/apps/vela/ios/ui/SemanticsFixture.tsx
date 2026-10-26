import { mount, signal, Text, token, View } from 'nsh';
import { Button } from 'nsh/base';
import { reduceMotion } from 'nsh/accessibility';
import { fontScale } from 'nsh/device';
import { BottomMenu } from './ui';

function App() {
  const open = signal(false);
  const result = signal('none');
  return (
    <View class="flex-1 bg-background p-4 text-foreground">
      <Text>theme {token('accent')}</Text>
      <Text>reduced motion {String(reduceMotion())}</Text>
      <Text>font scale {fontScale().toFixed(2)}</Text>
      <Button accessibilityLabel="Open menu" onPress={() => open.set(true)}><Text>Open menu</Text></Button>
      <Text>result {result()}</Text>
      <BottomMenu
        open={open()}
        onClose={() => open.set(false)}
        groups={[[
          { id: 'inspect', label: 'Inspect device', onSelect: () => result.set('inspect') },
          { id: 'disabled', label: 'Unavailable action', disabled: true, onSelect: () => result.set('invalid') },
        ]]}
      />
    </View>
  );
}

mount(App);
