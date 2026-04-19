import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
