import { useMemo, useState } from 'react';
import Logo from '../components/Logo';
import BackLink from '../components/BackLink';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import Button from '../components/ui/Button';
import { LockIcon, MailIcon } from '../components/icons/Icons';
import { useNavigate } from '../router';
import { useAuth } from '../auth/AuthContext';
import authStyles from '../styles/auth.module.css';

function readRecoveryParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  return {
    token: search.get('token') || hash.get('token') || '',
    accessToken: hash.get('access_token') || search.get('access_token') || '',
    refreshToken: hash.get('refresh_token') || search.get('refresh_token') || '',
  };
}

function validatePassword(value) {
  if (!value) return 'La contraseña es obligatoria.';
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  return '';
}

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const params = useMemo(() => readRecoveryParams(), []);
  const hasLinkToken = Boolean(params.token || params.accessToken);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({
    correo: '',
    codigo: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    const confirmError = !confirmPassword
      ? 'Debes confirmar tu contraseña.'
      : password !== confirmPassword
        ? 'Las contraseñas no coinciden.'
        : '';
    const correoError =
      !hasLinkToken && !correo.trim() ? 'El correo electrónico es obligatorio.' : '';
    const codigoError =
      !hasLinkToken && codigo.trim().length !== 6 ? 'Ingresa el código de 6 dígitos.' : '';

    setErrors({
      correo: correoError,
      codigo: codigoError,
      password: passwordError,
      confirmPassword: confirmError,
    });
    setFormError('');
    setSuccess('');
    if (passwordError || confirmError || correoError || codigoError) return;

    setLoading(true);
    try {
      const data = await resetPassword({
        token: params.token || undefined,
        accessToken: params.accessToken || undefined,
        refreshToken: params.refreshToken || undefined,
        correo: hasLinkToken ? undefined : correo.trim(),
        codigo: hasLinkToken ? undefined : codigo.trim(),
        password,
      });
      setSuccess(data.message || 'La contraseña se restableció correctamente.');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (error) {
      setFormError(error.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={authStyles.card}>
      <BackLink to="/login">Volver al inicio de sesión</BackLink>
      <Logo />

      <header className={authStyles.header}>
        <h1 className={authStyles.title}>Nueva contraseña</h1>
        <p className={authStyles.subtitle}>
          {hasLinkToken
            ? 'Elige una contraseña nueva para tu cuenta.'
            : 'Ingresa el código de 6 dígitos y tu nueva contraseña.'}
        </p>
      </header>

      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={authStyles.formError} role="alert">
            {formError}
          </p>
        )}
        {success && (
          <p className={authStyles.formSuccess} role="status">
            {success}
          </p>
        )}

        {!hasLinkToken && (
          <>
            <Input
              id="reset-email"
              label="Correo electrónico"
              type="email"
              placeholder="correo@ejemplo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              icon={MailIcon}
              error={errors.correo}
              autoComplete="email"
              disabled={loading}
            />
            <Input
              id="reset-code"
              label="Código de 6 dígitos"
              type="text"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={errors.codigo}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={loading}
            />
          </>
        )}

        <PasswordInput
          id="reset-password"
          label="Nueva contraseña"
          placeholder="Crea una contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={LockIcon}
          error={errors.password}
          autoComplete="new-password"
          disabled={loading}
          showPassword={showPassword}
          onToggleVisibility={() => setShowPassword((prev) => !prev)}
        />

        <PasswordInput
          id="reset-confirm-password"
          label="Confirmar contraseña"
          placeholder="Repite tu contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={LockIcon}
          error={errors.confirmPassword}
          autoComplete="new-password"
          disabled={loading}
          showPassword={showConfirmPassword}
          onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
        />

        <Button type="submit" loading={loading} disabled={loading}>
          Guardar contraseña
        </Button>
      </form>
    </div>
  );
}
