import { ClerkProvider } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}
