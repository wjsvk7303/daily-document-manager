import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
            일자별 문서 보관함
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 mb-10 leading-relaxed">
            문서를 날짜별로 체계적으로 관리하세요.<br />
            카테고리 분류, 캘린더 보기, 이미지 첨부까지<br />
            간편하게 문서를 보관하고 검색할 수 있습니다.
          </p>

          <SignedOut>
            <div className="flex gap-4 justify-center flex-wrap">
              <SignUpButton>
                <button className="bg-[#4a90d9] hover:bg-[#357abd] text-white rounded-lg font-semibold text-base h-12 px-8 transition-colors cursor-pointer shadow-md">
                  무료로 시작하기
                </button>
              </SignUpButton>
              <SignInButton>
                <button className="border border-[#4a90d9] text-[#4a90d9] hover:bg-[#4a90d9]/10 rounded-lg font-semibold text-base h-12 px-8 transition-colors cursor-pointer">
                  로그인
                </button>
              </SignInButton>
            </div>
          </SignedOut>

          <SignedIn>
            <Link
              href="/documents"
              className="inline-block bg-[#4a90d9] hover:bg-[#357abd] text-white rounded-lg font-semibold text-base h-12 px-8 leading-[48px] transition-colors shadow-md"
            >
              문서 관리 시작하기
            </Link>
          </SignedIn>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <FeatureCard
            icon="📅"
            title="날짜별 정리"
            description="캘린더 보기와 날짜 필터로 문서를 시간순으로 관리합니다."
          />
          <FeatureCard
            icon="🗂️"
            title="카테고리 분류"
            description="자유롭게 카테고리를 만들어 문서를 분류하세요."
          />
          <FeatureCard
            icon="🖼️"
            title="이미지 첨부"
            description="드래그 앤 드롭, 클립보드 붙여넣기로 이미지를 첨부합니다."
          />
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: string; title: string; description: string
}) {
  return (
    <div className="rounded-xl p-6 shadow-sm border border-gray-200 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
