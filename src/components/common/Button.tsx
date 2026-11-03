import type { ButtonHTMLAttributes } from 'react';

export default function Button({ type = 'button', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`button ${className}`} {...props} />;
}
