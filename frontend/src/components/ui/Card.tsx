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
        'bg-white rounded-lg border border-gray-200/60',
        padding ? 'p-5' : '',
        className,
      ].join(' ')}
    >
      {title && (
        <h3 className="text-sm font-semibold text-gray-900 mb-3 px-5 pt-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
