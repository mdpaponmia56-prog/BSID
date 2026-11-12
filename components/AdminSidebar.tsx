"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  IdCard,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
  XCircle,
} from "lucide-react";

interface AdminSidebarProps {
  adminEmail: string;
  adminName: string;
}

export default function AdminSidebar({
  adminEmail,
  adminName,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      label: "Dashboard Overview",
      href: "/admin",
      icon: LayoutDashboard,
      active: pathname === "/admin",
    },
    {
      label: "All Applications",
      href: "/admin/applications",
      icon: FileText,
      active:
        pathname === "/admin/applications" &&
        (!statusParam || statusParam === "all"),
    },
    {
      label: "Pending Applications",
      href: "/admin/applications?status=Pending",
      icon: Clock,
      active:
        pathname === "/admin/applications" && statusParam === "Pending",
    },
    {
      label: "Approved Applications",
      href: "/admin/applications?status=Approved",
      icon: CheckCircle2,
      active:
        pathname === "/admin/applications" && statusParam === "Approved",
    },
    {
      label: "Rejected Applications",
      href: "/admin/applications?status=Rejected",
      icon: XCircle,
      active:
        pathname === "/admin/applications" && statusParam === "Rejected",
    },
    {
      label: "ID Card Generator",
      href: "/admin/generator",
      icon: IdCard,
      active: pathname.startsWith("/admin/generator"),
    },
    {
      label: "Template Management",
      href: "/admin/templates",
      icon: LayoutTemplate,
      active: pathname.startsWith("/admin/templates"),
    },
    {
      label: "Download Center",
      href: "/admin/downloads",
      icon: Download,
      active: pathname.startsWith("/admin/downloads"),
    },
    {
      label: "Settings",
      href: "/admin/settings",
      icon: Settings,
      active: pathname.startsWith("/admin/settings"),
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 w-68">
      <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9b0084] to-[#178a2e] flex items-center justify-center text-white shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">
              BS ID Admin
            </p>
            <p className="text-[11px] text-slate-400">Bangladesh Scouts</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                item.active
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="px-2 flex items-center gap-3">
          <UserButton />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {adminName}
            </p>
            <p className="text-[11px] text-emerald-400 truncate">
              {adminEmail}
            </p>
          </div>
        </div>

        <SignOutButton redirectUrl="/sign-in">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/15 hover:text-red-200 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </SignOutButton>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-slate-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 no-print">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-sm">BS ID Admin Dashboard</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg bg-slate-800 text-white"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 border-r border-slate-200 min-h-screen no-print">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
