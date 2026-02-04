import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FollowBack - Win Back Your Best Customers",
  description: "Lightweight CRM for service businesses to win back lost customers",
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
