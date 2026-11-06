import { useState } from 'react';
import { Link, useNavigate } from '../router';
import { useAuth } from '../auth/AuthContext';
import styles from './AdminAccess.module.css';

export default function AdminRegister() {
  const { registerAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const result = await registerAdmin({
        nombre: form.nombre.trim(), correo: form.correo.trim(), password: form.password,
        modo: 'cliente',
      });
      navigate(result.tokens?.accessToken ? '/admin' : '/admin/login', { replace: true });
    } catch (reason) {
      setError(reason.message || 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return <div className={styles.card}>
    <div className={styles.mark}>OY<span> / CONTROL</span></div>
    <p className={styles.kicker}>ACCESO RESTRINGIDO</p>
    <h1>Alta de administrador</h1>
    <p className={styles.description}>Crea tu espacio de gestión con un correo válido y una contraseña segura.</p>
    <form onSubmit={submit} className={styles.form}>
      <label>Nombre completo<input name="nombre" autoComplete="name" value={form.nombre} onChange={change} required minLength={2} maxLength={150} /></label>
      <label>Correo electrónico<input name="correo" type="email" autoComplete="email" value={form.correo} onChange={change} required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="new-password" value={form.password} onChange={change} required minLength={8} /></label>
      <label>Confirmar contraseña<input name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={change} required /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button disabled={busy} type="submit">{busy ? 'Creando cuenta…' : 'Crear cuenta de administrador'}</button>
    </form>
    <p className={styles.footer}>¿Ya tienes cuenta? <Link to="/admin/login">Inicia sesión</Link></p>
  </div>;
}
