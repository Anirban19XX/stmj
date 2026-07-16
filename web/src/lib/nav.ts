import {
  LayoutDashboard,
  Activity,
  Receipt,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Your escrows and actions",
  },
  {
    label: "Activity",
    href: "/activity",
    icon: Activity,
    description: "Live contract events",
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: Receipt,
    description: "Transaction history & status",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Marketplace metrics",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Wallet & preferences",
  },
];
