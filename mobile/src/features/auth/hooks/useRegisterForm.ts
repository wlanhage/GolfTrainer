import { useState } from 'react';
import { useAuth } from '../../../shared/store/authStore';

export function useRegisterForm() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await register({ displayName, email, password });
    } catch {
      setError('Kunde inte registrera konto. Kontrollera dina uppgifter.');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    displayName,
    email,
    password,
    setDisplayName,
    setEmail,
    setPassword,
    submitting,
    error,
    submit
  };
}
