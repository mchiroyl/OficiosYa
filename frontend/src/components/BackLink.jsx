import { Link } from '../router';
import { ChevronLeftIcon } from './icons/Icons';
import styles from './BackLink.module.css';

export default function BackLink({ to, children, className = '' }) {
  return (
    <Link to={to} className={[styles.link, className].filter(Boolean).join(' ')}>
      <ChevronLeftIcon />
      <span>{children}</span>
    </Link>
  );
}
