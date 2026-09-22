import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { colors } from '../theme/colors';
import './ui.css';

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`screen ${className}`.trim()}>{children}</div>;
}

export function Card({
  children,
  onClick,
  variant = 'plan',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'plan' | 'day' | 'surface';
}) {
  const bg =
    variant === 'plan'
      ? colors.planCardBackground
      : variant === 'day'
        ? colors.dayCardBackground
        : colors.darkSurface;

  return (
    <div
      className={`card${onClick ? ' card-clickable' : ''}`}
      style={{ backgroundColor: bg }}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="title">{children}</h1>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <p className="subtitle">{children}</p>;
}

export function Field(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, id, ...rest } = props;
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input id={inputId} className="field-input" {...rest} />
    </label>
  );
}

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button className={`btn btn-${variant} ${className}`.trim()} type={type} {...rest}>
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="error-text">{children}</p>;
}

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <div className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={`btn-icon ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconSync({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={spinning ? 'icon-sync-spin' : undefined}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

export function IconLogout() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconArrowRight() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
