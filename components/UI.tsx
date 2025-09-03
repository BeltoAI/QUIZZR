import { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-100 p-6">{children}</div>;
}

export function Button({ children, onClick, type = 'button', disabled }:
  { children: ReactNode; onClick?: () => void; type?: 'button'|'submit'|'reset'; disabled?: boolean; }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium ring-1 ring-slate-200 bg-slate-900 text-white hover:opacity-95 disabled:opacity-50">
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>;
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="text-sm font-medium text-slate-700">{children}</label>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold">{children}</h2>;
}
