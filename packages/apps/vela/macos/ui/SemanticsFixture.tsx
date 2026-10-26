import { cleanup, computed, mount, signal, Text, token, View } from 'nsh';
import { Button as BaseButton, Menu, MenuItem } from 'nsh/base';
import { reduceMotion } from 'nsh/accessibility';
import { fontScale } from 'nsh/device';
import { ListRow, RadioGroup, Segmented } from './ui';

const selected = signal<'one' | 'two'>('one');
const plan = signal<'free' | 'team'>('free');
const count = signal(1);
const menuOpen = signal(false);
const timerVisible = signal(true);
const timerCalls = signal(0);
const reportedRuns = signal(0);
let computedRuns = 0;
const doubled = computed(() => {
  computedRuns += 1;
  return count() * 2;
});

function OwnedTimer() {
  const timer = setTimeout(() => timerCalls.update((value) => value + 1), 100);
  cleanup(() => clearTimeout(timer));
  return <Text>timer mounted</Text>;
}

function App() {
  return (
    <View class="flex-1 gap-4 bg-background p-4 text-foreground">
      <Text testID="theme-value">theme {token('accent')}</Text>
      <Text>reduced motion {String(reduceMotion())}</Text>
      <Text>font scale {fontScale().toFixed(2)}</Text>
      <Text testID="computed-value">derived {doubled()}</Text>
      <Text>computed runs {reportedRuns()}</Text>
      <BaseButton accessibilityLabel="Increment" onPress={() => count.update((value) => value + 1)}><Text>Increment</Text></BaseButton>
      <BaseButton accessibilityLabel="Report runs" onPress={() => reportedRuns.set(computedRuns)}><Text>Report runs</Text></BaseButton>
      <Segmented label="Mode" value={selected()} options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }]} onChange={(value) => selected.set(value)} />
      <Text>selected {selected()}</Text>
      <RadioGroup label="Plan" value={plan()} options={[{ value: 'free', label: 'Free' }, { value: 'team', label: 'Team' }]} onChange={(value) => plan.set(value)} />
      <Text>plan {plan()}</Text>
      <ListRow title="Open device" description="在线 · 2 个服务" accessibilityLabel="Open device，在线，2 个服务" onPress={() => selected.set('two')} />
      <ListRow title="Unavailable" disabled onPress={() => selected.set('two')} />
      <BaseButton accessibilityLabel="Open commands" onPress={() => menuOpen.set(true)}><Text>Open commands</Text></BaseButton>
      <Menu open={menuOpen()} onOpenChange={(open) => menuOpen.set(open)} popupClass="bg-popover p-2" trigger={<View />}>
        <MenuItem accessibilityLabel="Run command" onSelect={() => selected.set('two')}><Text>Run command</Text></MenuItem>
      </Menu>
      <BaseButton accessibilityLabel="Hide timer" onPress={() => timerVisible.set(false)}><Text>Hide timer</Text></BaseButton>
      <If when={timerVisible()}><OwnedTimer /></If>
      <Text>timer calls {timerCalls()}</Text>
    </View>
  );
}

mount(App);
