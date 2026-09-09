import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '../components/ui';

export function LoginScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, pin);
      navigate('/plans', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Workout Planner</Title>
      <Subtitle>Sign in with your username and 4-digit PIN.</Subtitle>

      <form onSubmit={handleSubmit}>
        <Field
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g., alex"
        />
        <Field
          label="PIN"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={4}
          pattern="\d{4}"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" disabled={loading || !username || pin.length !== 4}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="auth-links">
        <Link to="/signup">Create account</Link>
        <Link to="/forgot-pin">Forgot PIN?</Link>
      </div>
    </Screen>
  );
}
