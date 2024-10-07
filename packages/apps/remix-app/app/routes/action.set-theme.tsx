import { createThemeAction } from 'remix-themes';
import { themeSessionResolver } from '../sessions.server';

export const action = createThemeAction(themeSessionResolver);

export const ActionSetThemePage: React.FC<{}> = () => {
  return null;
};

export default ActionSetThemePage;
