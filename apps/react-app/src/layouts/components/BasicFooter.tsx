export function BasicFooter() {
  return (
    <footer className="mt-12">
      <p className="ext-center text-muted text-xs">
        Copyright &copy; 2026 All Rights Reserved.
      </p>
      <div className="flex items-end justify-center">
        <a
          href="https://github.com/KanoCifer/Flask-Example"
          aria-label="Kuroome on GitHub"
          className="hover:opacity-90"
          target="_blank"
        >
          <img
            alt="Powered by Flask"
            src="https://github.githubassets.com/favicons/favicon.svg"
            className="cover aspect-square size-4 object-cover align-bottom"
          />
        </a>
        <a
          className="ext-center text-muted text-xs hover:underline"
          href="https://beian.miit.gov.cn/#/Integrated/index"
          target="_blank"
        >
          &nbsp;粤ICP备2026018113号
        </a>
        <a
          className="ext-center text-muted text-xs hover:underline"
          href="/privacy"
        >
          &nbsp;隐私政策
        </a>
      </div>
    </footer>
  );
}
