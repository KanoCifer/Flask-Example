declare module 'pace-js' {
  interface PaceOptions {
    theme?: string;
    minTime?: number;
    ghostTime?: number;
    catchupTime?: number;
    restartOnPushState?: boolean;
    restartOnRequestAfter?: number;
    elements?: {
      checkInterval?: number;
      selectors?: string[];
    };
    ajax?: {
      trackMethods?: string[];
      trackWebSockets?: boolean;
      ignoreURLs?: string[];
    };
  }

  interface PaceStatic {
    start(options?: PaceOptions): void;
    stop(): void;
    restart(): void;
    go(milestone: number): void;
    bar: {
      progress: number;
    };
  }

  const Pace: PaceStatic;

  export default Pace;
}
