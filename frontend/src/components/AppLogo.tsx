const AppLogo = () => {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] px-5">
      <div className="mx-auto max-w-lg">
        <div className="flex w-fit items-center gap-0">
          <img src="/logov1.png" alt="A" className="h-9 w-auto object-contain" />
          <span className="pb-[1px] text-sm font-semibold uppercase tracking-[0.24em] text-white sm:text-base">
            NOVA
          </span>
        </div>
      </div>
    </div>
  );
};

export default AppLogo;
