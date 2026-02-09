import type { Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '일자별 문서 보관함',
  description: '문서를 날짜별로 체계적으로 관리하세요',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="ko">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <header className="flex justify-between items-center px-6 h-16 border-b border-gray-200">
            <Link href="/" className="font-bold text-lg text-[#4a90d9]">
              문서 보관함
            </Link>
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton>
                  <button className="text-sm font-medium cursor-pointer hover:text-[#4a90d9] transition-colors">
                    로그인
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="bg-[#4a90d9] hover:bg-[#357abd] text-white rounded-lg font-medium text-sm h-9 px-4 cursor-pointer transition-colors">
                    회원가입
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/documents" className="text-sm font-medium hover:text-[#4a90d9] transition-colors">
                  내 문서
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
