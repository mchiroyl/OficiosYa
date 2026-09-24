import styles from './Input.module.css';

export default function Input({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  icon: Icon,
  rightElement,
  error,
  success,
  disabled,
  autoComplete,
  inputRef,
  ...rest
}) {
  const fieldClass = [
    styles.field,
    error && styles.error,
    success && styles.success,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(' ');

  const inputClass = [
    styles.input,
    Icon && styles.hasLeftIcon,
    rightElement && styles.hasRightIcon,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fieldClass}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.wrapper}>
        {Icon && (
          <span className={styles.iconLeft} aria-hidden="true">
            <Icon />
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type={type}
          className={inputClass}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        {rightElement && <div className={styles.iconRight}>{rightElement}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.message} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
