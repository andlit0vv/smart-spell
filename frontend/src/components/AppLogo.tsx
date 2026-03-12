const AppLogo = () => {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80]">
      <div className="mx-auto flex w-full max-w-lg px-5">
        <div className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 backdrop-blur-sm">
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
