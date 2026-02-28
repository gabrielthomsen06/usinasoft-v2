import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ title, children, className = '', padding = true }: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-xl shadow-sm border border-gray-100',
        padding ? 'p-6' : '',
        className,
      ].join(' ')}
    >
      {title && (
        <h3 className="text-base font-semibold text-secondary mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
