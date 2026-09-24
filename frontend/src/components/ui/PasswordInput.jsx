import Input from './Input';
import { EyeIcon, EyeOffIcon } from '../icons/Icons';
import styles from './PasswordInput.module.css';

export default function PasswordInput({
  showPassword = false,
  onToggleVisibility,
  ...rest
}) {
  return (
    <Input
      {...rest}
      type={showPassword ? 'text' : 'password'}
      rightElement={
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggleVisibility}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}
