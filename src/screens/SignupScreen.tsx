import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../services/authService';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '../components/ui';

export function SignupScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);
    try {
      await signup(username, pin);
      navigate('/plans', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Create account</Title>
      <Subtitle>Pick a username and 4-digit PIN. Use the same on any device.</Subtitle>

      <form onSubmit={handleSubmit}>
        <Field
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="3–20 letters, numbers, underscore"
        />
        <Field
          label="PIN"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 digits"
        />
        <Field
          label="Confirm PIN"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 digits"
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button
          type="submit"
          disabled={loading || !username || pin.length !== 4 || confirmPin.length !== 4}
        >
          {loading ? 'Creating…' : 'Create account'}
        </Button>
      </form>

      <div className="auth-links">
        <Link to="/login">Already have an account?</Link>
      </div>
    </Screen>
  );
}
