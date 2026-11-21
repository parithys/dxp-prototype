'use client';
// Link, NavLink and Navigate over the navigation hooks (routerHooks.ts), so a click goes through the same blockers and location state as navigate().
import { useEffect } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigate } from './routerHooks';

const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean; state?: unknown };
export function Link({ to, replace, state, onClick, children, ...rest }: LinkProps) {
  const navigate = useNavigate();
  return (
    <a
      {...rest}
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !plainClick(e) || rest.target === '_blank') return;
        e.preventDefault();
        navigate(to, { replace, state });
      }}
    >
      {children}
    </a>
  );
}

type NavLinkProps = Omit<LinkProps, 'className'> & { className?: string | ((s: { isActive: boolean }) => string); end?: boolean };
export function NavLink({ to, end, className, ...rest }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return <Link to={to} className={typeof className === 'function' ? className({ isActive }) : className} {...rest} />;
}

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  useEffect(() => navigate(to, { replace, state }), [navigate, to, replace, state]);
  return null;
}
