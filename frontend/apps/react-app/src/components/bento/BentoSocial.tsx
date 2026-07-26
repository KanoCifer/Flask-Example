import { Mail } from 'lucide-react';

const socialLinks = [
  {
    name: 'GitHub',
    href: 'https://github.com/KanoCifer',
    icon: 'github',
  },
  {
    name: 'Email',
    href: 'mailto:kano3255@outlook.com',
    icon: 'email',
  },
];

export function BentoSocial() {
  return (
    <div className="flex items-center justify-center gap-4">
      {socialLinks.map((social) => (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.name}
          className="group /50 bg-page/80 text-muted hover:border-accent/50 hover:bg-accent/10 hover:text-ink relative flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
        >
          <span className="bg-page text-muted absolute -top-11 scale-0 rounded-xl px-3 py-1.5 text-xs font-medium opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
            {social.name}
          </span>
          {social.icon === 'github' && (
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
          )}
          {social.icon === 'email' && <Mail className="h-5 w-5" />}
        </a>
      ))}
    </div>
  );
}
