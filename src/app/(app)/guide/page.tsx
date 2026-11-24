import Link from "next/link";
import { GUIDE_SECTIONS } from "@/lib/user-guide";

export default function GuidePage() {
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">AgileCampus 使用说明</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">用户指南</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">从团队、项目和任务开始，了解平台中每个功能栏的使用方式。</p>
        </div>
        <Link href="/guide?guide=sidebar" className="ac-btn">重新查看侧边栏引导</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {GUIDE_SECTIONS.map((section) => (
          <section key={section.title} className="ac-card space-y-3 p-5">
            <h2 className="font-display text-base font-semibold text-ink">{section.title}</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-soft">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>

      <section className="ac-card bg-primary-soft p-5 text-sm text-ink-soft">
        <h2 className="font-display font-semibold text-ink">需要帮助时</h2>
        <p className="mt-2 leading-6">先打开对应的团队或项目，再查看页面上的操作按钮。侧边栏右下角的问号按钮始终可以重新启动引导。</p>
      </section>
    </main>
  );
}
