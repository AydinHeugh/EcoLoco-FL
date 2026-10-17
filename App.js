import AppNavigator from './frontend/navigation/AppNavigator';
import AppErrorBoundary from './frontend/components/AppErrorBoundary';

export default function App() {
  return <AppErrorBoundary><AppNavigator /></AppErrorBoundary>;
}
