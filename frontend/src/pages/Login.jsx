import { useEffect, useState } from 'react';
import Logo from '../components/Logo';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import { MailIcon, LockIcon, CheckCircleIcon } from '../components/icons/Icons';
import { Link, useNavigate } from '../router';
import { useAuth } from '../auth/AuthContext';
import authStyles from '../styles/auth.module.css';
import styles from './Login.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value) {
  if (!value.trim()) return 'El correo electrónico es obligatorio.';
  if (!EMAIL_REGEX.test(value.trim())) return 'El correo electrónico no es válido.';
  return '';
}

function validatePassword(value) {
  if (!value) return 'La contraseña es obligatoria.';
  return '';
}

function readRegisterSuccess() {
  try {
    const raw = sessionStorage.getItem('oficiosya.registerSuccess');
    if (!raw) return null;
    sessionStorage.removeItem('oficiosya.registerSuccess');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const registered = readRegisterSuccess();
  const [email, setEmail] = useState(registered?.correo || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState(registered);
  const [toastVisible, setToastVisible] = useState(Boolean(registered));
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });

  useEffect(() => {
    if (!toast) return undefined;

    const hideTimer = setTimeout(() => setToastVisible(false), 4500);
    const removeTimer = setTimeout(() => setToast(null), 5000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [toast]);

  const handleEmailBlur = () => {
    setTouched((prev) => ({ ...prev, email: true }));
    setErrors((prev) => ({ ...prev, email: validateEmail(email) }));
  };

  const handlePasswordBlur = () => {
    setTouched((prev) => ({ ...prev, password: true }));
    setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setTouched({ email: true, password: true });
    setErrors({ email: emailError, password: passwordError });
    setFormError('');

    if (emailError || passwordError) return;

    setLoading(true);
    try {
      await login({
        correo: email.trim(),
        password,
        rememberMe,
      });
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(error.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const emailIsValid = touched.email && !errors.email && email.trim() !== '';
  const showEmailError = touched.email && errors.email;
  const showPasswordError = touched.password && errors.password;

  return (
    <div className={authStyles.card}>
      {toast && (
        <div
          className={`${styles.toast} ${toastVisible ? styles.toastIn : styles.toastOut}`}
          role="status"
        >
          <span className={styles.toastIcon} aria-hidden="true">
            <CheckCircleIcon />
          </span>
          <div className={styles.toastCopy}>
            <p className={styles.toastTitle}>Cuenta creada exitosamente.</p>
            <p className={styles.toastText}>
              Registramos tu usuario correctamente. Inicia sesión
              {toast.correo ? (
                <>
                  {' '}con <span className={styles.toastEmail}>{toast.correo}</span>
                </>
              ) : null}{' '}
              para continuar.
            </p>
          </div>
        </div>
      )}

      <Logo />

      <header className={authStyles.header}>
        <h1 className={authStyles.title}>Iniciar sesión</h1>
        <p className={authStyles.subtitle}>
          Ingresa tus datos para acceder a tu cuenta.
        </p>
      </header>

      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={authStyles.formError} role="alert">
            {formError}
          </p>
        )}

        <Input
          id="login-email"
          label="Correo electrónico"
          type="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          icon={MailIcon}
          error={showEmailError ? errors.email : ''}
          success={emailIsValid}
          autoComplete="email"
          disabled={loading}
        />

        <PasswordInput
          id="login-password"
          label="Contraseña"
          placeholder="Ingresa tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={handlePasswordBlur}
          icon={LockIcon}
          error={showPasswordError ? errors.password : ''}
          autoComplete="current-password"
          disabled={loading}
          showPassword={showPassword}
          onToggleVisibility={() => setShowPassword((prev) => !prev)}
        />

        <div className={styles.options}>
          <Checkbox
            id="remember"
            label="Recordarme"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <Link to="/forgot-password" className={styles.forgotLink}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" loading={loading} disabled={loading}>
          Iniciar sesión
        </Button>
      </form>

      <p className={authStyles.footer}>
        ¿No tienes una cuenta?{' '}
        <Link to="/register" className={authStyles.footerLink}>
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
