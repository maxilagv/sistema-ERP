import { InputHTMLAttributes, forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
    className?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(({ className, ...props }, ref) => {
    return (
        <input
            ref={ref}
            className={`
        px-3 py-2 rounded-md outline-none transition-colors
        bg-slate-800 border border-slate-700 text-slate-200
        focus:border-indigo-500 focus:bg-slate-900
        placeholder:text-slate-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className || ''}
      `}
            {...props}
        />
    );
});

Input.displayName = 'Input';

export default Input;
