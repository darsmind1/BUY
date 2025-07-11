import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BusesUY',
  description: 'Your guide to buses in Montevideo.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body font-light antialiased bg-gray-900 flex items-center justify-center min-h-dvh">
        <div className="w-[390px] h-[844px] bg-background shadow-2xl rounded-3xl overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
