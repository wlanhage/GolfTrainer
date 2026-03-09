import { useState } from 'react';
import { useAuth } from '../../../shared/store/authStore';

export function useLoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch {
      setError('Kunde inte logga in. Kontrollera e-post/lösenord.');
    } finally {
      setSubmitting(false);
    }
  };

  return { email, password, setEmail, setPassword, submitting, error, submit };
}
