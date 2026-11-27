import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Prompt } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Navbar } from '@/components/Navbar';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ระบบหาชั่วโมงทุน | DIT RSU',
  description: 'โครงงานระบบหาชั่วโมงทุนสำหรับนักศึกษาทุน มหาวิทยาลัยรังสิต (DIT204/DIT205)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${prompt.className} min-h-screen flex flex-col bg-slate-50/80 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-200`}>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {children}
            </main>
            <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 py-6 mt-12 text-xs text-slate-500 dark:text-slate-400">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    ระบบหาชั่วโมงทุน (RSU Scholarship Volunteer System)
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 mt-0.5">
                    จัดทำโดย นายพจน์กฤษฎิ์ วรรณภาส (6801457) • วิทยาลัยนวัตกรรมดิจิทัลเทคโนโลยี มหาวิทยาลัยรังสิต
                  </p>
                </div>
                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                  <Link href="/" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    หน้าหลัก
                  </Link>
                  <Link href="/activities" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                    กิจกรรมจิตอาสา
                  </Link>
                  <Link href="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition font-medium">
                    เข้าสู่ระบบ
                  </Link>
                </div>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
