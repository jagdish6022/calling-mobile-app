import { registerWebModule, NativeModule } from 'expo';

// CallingAppModule is not available on the web platform.
class CallingAppModule extends NativeModule<{}> {}

export default registerWebModule(CallingAppModule, 'CallingAppModule');
