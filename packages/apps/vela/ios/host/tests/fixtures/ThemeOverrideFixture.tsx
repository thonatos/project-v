import { mount, View } from 'nsh';
import { Symbol, Toggle } from '../../../ui/ui/native';

function App() {
  return (
    <View class="h-10 w-10 bg-accent">
      <Symbol name="circle.fill" color="accent" />
      <Toggle value label="Theme toggle" onChange={() => {}} />
    </View>
  );
}

mount(App);
