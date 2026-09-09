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
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button className={`btn btn-${variant}`} type={type} {...rest}>
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
