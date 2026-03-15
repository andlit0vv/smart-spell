const LOGO_URL = "https://t.me/aivion_agency_bot";

const AppLogo = () => {
  return (
    <header className="px-5 pb-2 pt-4">
      <div className="mx-auto max-w-lg">
        <a
          href={LOGO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="ANOVA"
          className="flex w-fit items-center gap-0"
        >
          <img src="/logov1.png" alt="A" className="h-9 w-auto object-contain" />
          <span className="pb-[1px] text-sm font-semibold uppercase tracking-[0.24em] text-foreground sm:text-base">
            NOVA
          </span>
        </a>
      </div>
    </header>
  );
};

export default AppLogo;
