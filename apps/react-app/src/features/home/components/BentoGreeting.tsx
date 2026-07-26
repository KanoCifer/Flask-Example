import { BentoCard } from '@/components';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

export function BentoGreeting() {
  const greeting =
    dayjs().hour() < 12
      ? 'Good Morning'
      : dayjs().hour() < 18
        ? 'Good Afternoon'
        : 'Good Evening';
  const navigate = useNavigate();

  const isEvening = dayjs().hour() >= 18 || dayjs().hour() < 6;
  return (
    <BentoCard className="border-accent/30! from-accent/90 to-accent/90 relative overflow-hidden bg-linear-to-br p-8 shadow-xl">
      <div className="relative z-10 flex flex-col justify-center">
        <h3 className="text-ink/80 mb-1 font-serif text-sm font-medium">
          {greeting}
        </h3>
        <h4 className="text-ink font-serif text-3xl leading-tight font-extrabold">
          Ready for a productive
        </h4>
        <h4 className="text-ink mb-4 font-serif text-3xl leading-tight font-extrabold">
          session now?
        </h4>
        <div className="mt-2">
          <button
            onClick={() => navigate('/todos')}
            className="bg-accent/20 text-ink hover:bg-accent/30 rounded-full px-6 py-2.5 text-sm font-semibold backdrop-blur-md transition-all active:scale-95"
          >
            Check Today's Tasks
          </button>
        </div>

        {/* <!-- Decorative Abstract Shape --> */}
        <div className="bg-accent/10 absolute -right-10 -bottom-10 h-48 w-48 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20">
          {isEvening ? (
            <svg
              className="text-ink h-24 w-24"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="text-ink h-24 w-24"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
