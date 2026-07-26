import { BentoCard } from '@/components';
import { motion } from 'framer-motion';
import { SPRING } from '@/constants/springs';

export function BentoTech() {
  const techStack = [
    'Python',
    'TaskIQ',
    'Vue',
    'Postgre',
    'SQLAlchemy',
    'FastAPI',
    'Redis',
    'MongoDB',
    'React',
  ];

  return (
    <BentoCard className="h-full">
      <div className="h-full p-2">
        <h3 className="text-ink mb-3 flex items-center gap-2 text-sm font-bold">
          <svg
            className="text-ink h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Tech Stack
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {techStack.map((tech) => (
            <motion.span
              key={tech}
              whileTap={{ scale: 0.95 }}
              transition={SPRING.snappy}
              className="/60 bg-surface text-muted cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold"
            >
              {tech}
            </motion.span>
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
