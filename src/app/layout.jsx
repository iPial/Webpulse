import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'Webpulse',
  description: 'Automated daily PageSpeed audits with categorized reports',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
