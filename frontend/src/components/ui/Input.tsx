import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-secondary"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full px-3 py-2 border rounded-lg text-sm text-secondary bg-white',
            'placeholder-gray-400 transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary',
            error
              ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
              : 'border-gray-300',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
