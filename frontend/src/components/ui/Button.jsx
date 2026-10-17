import styles from './Button.module.css';
import { SpinnerIcon } from '../icons/Icons';

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  icon: Icon,
  onClick,
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading;

  const classNames = [
    styles.button,
    styles[variant],
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className={styles.spinnerWrap} aria-hidden="true">
          <SpinnerIcon />
        </span>
      )}
      {Icon && !loading && (
        <span className={styles.icon} aria-hidden="true">
          <Icon />
        </span>
      )}
      <span className={loading ? styles.hiddenText : undefined}>{children}</span>
    </button>
  );
}
