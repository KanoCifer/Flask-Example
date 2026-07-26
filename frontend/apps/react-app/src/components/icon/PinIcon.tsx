interface IconProps {
  className?: string;
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M12 2.25l2.6 4.95 5.4.6-4.05 3.7 1.1 5.45L12 14.1l-5.05 2.85 1.1-5.45-4.05-3.7 5.4-.6L12 2.25z"
      />
    </svg>
  );
}
