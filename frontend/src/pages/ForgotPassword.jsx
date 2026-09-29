import { useState } from 'react';
import Logo from '../components/Logo';
import BackLink from '../components/BackLink';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { MailIcon } from '../components/icons/Icons';
import { Link } from '../router';
import { useAuth } from '../auth/AuthContext';
import authStyles from '../styles/auth.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value) {
  if (!value.trim()) return 'El correo electrónico es obligatorio.';
  if (!EMAIL_REGEX.test(value.trim())) return 'El correo electrónico no es válido.';
  return '';
}

function localRecoveryPath(enlace) {
  try {
    const parsed = new URL(enlace, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/reset-password';
  }
}

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [simulation, setSimulation] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    setTouched(true);
    setError(emailError);
    setSuccess('');
    setSimulation(null);
    if (emailError) return;

    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      setSuccess(
        data.message ||
          'Si el correo está registrado, te enviaremos instrucciones para restablecer la contraseña.',
      );
      if (data.envio?.codigo || data.envio?.enlace) {
        setSimulation(data.envio);
      }
    } catch (err) {
      setError(err.message || 'No se pudo enviar el correo de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={authStyles.card}>
      <BackLink to="/login">Volver al inicio de sesión</BackLink>
      <Logo />

      <header className={authStyles.header}>
        <h1 className={authStyles.title}>Recuperar contraseña</h1>
        <p className={authStyles.subtitle}>
          Ingresa tu correo. Te enviaremos un código y un enlace temporales para restablecerla.
        </p>
      </header>

      <form className={authStyles.form} onSubmit={handleSubmit} noValidate>
        {success && (
          <p className={authStyles.formSuccess} role="status">
            {success}
          </p>
        )}
        {simulation?.codigo && (
          <div className={authStyles.simulation} role="status">
            <p className={authStyles.simulationTitle}>Simulación de envío (HU-03)</p>
            <p>No se envió un correo real. Usa este código temporal o el enlace.</p>
            <p>
              Código: <strong>{simulation.codigo}</strong>
            </p>
            {simulation.enlace && (
              <Link to={localRecoveryPath(simulation.enlace)} className={authStyles.footerLink}>
                Abrir enlace de restablecimiento
              </Link>
            )}
          </div>
        )}

        <Input
          id="forgot-email"
          label="Correo electrónico"
          type="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => {
            setTouched(true);
            setError(validateEmail(email));
          }}
          icon={MailIcon}
          error={touched && error ? error : ''}
          autoComplete="email"
          disabled={loading}
        />

        <Button type="submit" loading={loading} disabled={loading}>
          Enviar instrucciones
        </Button>
      </form>

      <p className={authStyles.footer}>
        <Link to="/reset-password" className={authStyles.footerLink}>
          Ya tengo un código
        </Link>
      </p>
    </div>
  );
}
