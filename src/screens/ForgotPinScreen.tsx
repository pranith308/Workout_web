import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPin } from '../services/authService';
import { Button, ErrorText, Field, Screen, Subtitle, Title } from '../components/ui';

export function ForgotPinScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPin(username, newPin, inviteCode);
      navigate('/plans', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Forgot PIN</Title>
      <Subtitle>
        Enter your username, the shared invite code, and a new 4-digit PIN. You&apos;ll be signed in
        after reset.
      </Subtitle>

      <form onSubmit={handleSubmit}>
        <Field
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your username"
        />
        <Field
          label="Invite code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Same code used to create accounts"
          autoComplete="off"
        />
        <Field
          label="New PIN"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 digits"
        />
        <Field
          label="Confirm new PIN"
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
          disabled={
            loading ||
            !username ||
            !inviteCode.trim() ||
            newPin.length !== 4 ||
            confirmPin.length !== 4
          }
        >
          {loading ? 'Resetting…' : 'Reset PIN & sign in'}
        </Button>
      </form>

      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </Screen>
  );
}
