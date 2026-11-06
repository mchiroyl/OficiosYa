import { useState } from 'react';
import { Link, useNavigate } from '../router';
import { useAuth } from '../auth/AuthContext';
import styles from './AdminAccess.module.css';

export default function AdminLogin() {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginAdmin({ correo: correo.trim(), password, rememberMe });
      navigate('/admin', { replace: true });
    } catch (reason) {
      setError(reason.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return <div className={styles.card}>
    <div className={styles.mark}>OY<span> / CONTROL</span></div>
    <p className={styles.kicker}>ÁREA ADMINISTRATIVA</p>
    <h1>Bienvenido de nuevo.</h1>
    <p className={styles.description}>Ingresa para gestionar cuentas, oficios y la operación de OficiosYA.</p>
    <form onSubmit={submit} className={styles.form}>
      <label>Correo electrónico<input type="email" autoComplete="email" value={correo} onChange={(event) => setCorreo(event.target.value)} required /></label>
      <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label className={styles.check}><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Recordarme</label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar al panel'}</button>
    </form>
    <p className={styles.footer}>¿Nuevo administrador? <Link to="/admin/register">Crear cuenta</Link><br /><br /><Link to="/login">Acceso para clientes y trabajadores</Link></p>
  </div>;
}
