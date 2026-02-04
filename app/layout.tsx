import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://followback.vercel.app'),
  title: {
    default: "FollowBack CRM - Win Back Lost Customers",
    template: "%s | FollowBack CRM"
  },
  description: "Lightweight CRM for service businesses to automatically win back lost customers with targeted email and SMS campaigns.",
  keywords: ["CRM", "customer retention", "email marketing", "SMS marketing", "local business", "customer winback"],
  authors: [{ name: "FollowBack" }],
  creator: "FollowBack",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://followback.vercel.app",
    title: "FollowBack CRM - Win Back Lost Customers",
    description: "Lightweight CRM for service businesses to automatically win back lost customers with targeted email and SMS campaigns.",
    siteName: "FollowBack CRM",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FollowBack CRM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FollowBack CRM - Win Back Lost Customers",
    description: "Lightweight CRM for service businesses to automatically win back lost customers.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
