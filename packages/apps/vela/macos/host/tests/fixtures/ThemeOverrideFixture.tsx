import { mount, View } from 'nsh';
import { Button } from '../../../ui/ui/button';

function App() {
  return (
    <View class="h-10 w-10 bg-accent">
      <Button title="Theme" variant="primary" />
    </View>
  );
}

mount(App);
