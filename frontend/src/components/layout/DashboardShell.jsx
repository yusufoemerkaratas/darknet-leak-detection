import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

function DashboardShell({
  activeItem,
  onSelectItem,
  children,
  rightPanel,
  detectionEngine,
  searchValue,
  onSearchChange,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelect = (itemId) => {
    onSelectItem?.(itemId);
    setSidebarOpen(false);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--lg-body-bg)", color: "var(--lg-text)" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="stellar-field absolute inset-0" />
        <div className="stellar-dust absolute inset-0" />
        <div
          className="absolute inset-x-0 top-0 h-[300px]"
          style={{
            background:
              "radial-gradient(circle at top, rgba(110, 168, 215, 0.14), transparent 56%)",
          }}
        />
        <div
          className="stellar-cloud absolute -left-24 top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "rgba(110, 168, 215, 0.08)" }}
        />
        <div
          className="stellar-cloud absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "rgba(152, 179, 201, 0.07)" }}
        />
        <div
          className="stellar-cloud absolute right-[18%] top-[18%] h-52 w-52 rounded-full blur-3xl"
          style={{ background: "rgba(141, 119, 173, 0.06)" }}
        />
        <div className="grid-fade absolute inset-0 opacity-20" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1680px] px-3 py-3 xl:px-4 xl:py-4">
        <Sidebar
          activeItem={activeItem}
          detectionEngine={detectionEngine}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelectItem={handleSelect}
        />

        <div className="flex min-w-0 flex-1 flex-col xl:pl-[224px]">
          <Topbar
            onOpenSidebar={() => setSidebarOpen(true)}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            showNotifications={false}
            showProfile={false}
            showThemeToggle={true}
          />

          <main className="flex-1 px-1 pb-1 pt-1.5 sm:px-1.5 xl:px-2">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px] 2xl:grid-cols-[minmax(0,1fr)_270px]">
              <section className="min-w-0 space-y-3">{children}</section>
              <aside className="min-w-0 space-y-3">{rightPanel}</aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
