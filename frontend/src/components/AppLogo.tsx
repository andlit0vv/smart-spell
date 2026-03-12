const AppLogo = () => {
  return (
    <div className="pointer-events-none fixed left-4 top-4 z-[80] flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 backdrop-blur-sm">
      <img src="/logov1.png" alt="A" className="h-9 w-auto object-contain" />
      <span className="pb-[1px] text-sm font-semibold uppercase tracking-[0.24em] text-white sm:text-base">
        NOVA
      </span>
    </div>
  );
};

export default AppLogo;
