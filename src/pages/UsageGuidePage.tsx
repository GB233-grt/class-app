/**
 * 积分商城功能使用指南
 * 面向学生、教师与管理员，聚焦实际操作步骤。
 */
import { ArrowLeft, BookOpen, CheckCircle2, CircleHelp } from 'lucide-react';

export default function UsageGuidePage() {
  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 text-ink-700 sm:py-12">
      <article className="mx-auto w-full max-w-[760px] rounded-xl border border-ink-100 bg-white px-5 py-6 shadow-soft sm:px-10 sm:py-10">
        <a href="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
          <ArrowLeft className="h-4 w-4" />返回登录
        </a>
        <header className="mt-5 border-b border-ink-100 pb-5">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-700"><BookOpen className="h-4 w-4"/>积分商城使用指南</p>
          <h1 className="mt-2 text-3xl font-bold text-ink-950">按角色快速上手</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">学生用积分兑换，教师课堂加分并发放商品，管理员维护商品、区域与校园内容。</p>
        </header>

        <div className="mt-7 space-y-8 text-[15px] leading-[1.8]">
          <section>
            <h2 className="text-xl font-semibold text-ink-950">学生</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li>使用学校提供的邮箱与初始密码登录；首次登录后建议先到「设置 → 修改密码」更换初始密码。</li>
              <li>在「兑换商品」浏览商品卡片，点击商品进入详情，核对图片、上架时间、库存和价格后选择数量。</li>
              <li>确认兑换后，实物商品在「兑换记录」查看发放状态；网络商品在记录中打开下载链接。</li>
              <li>在「兑换记录」和「积分明细」底部点击「加载更多」查看较早记录。</li>
              <li>「设置 → 个人资料」可查看公开标签。校园主题视频默认关闭；如愿意观看，可自行开启、选择已审核视频，再点击播放。关闭开关即可撤回选择。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-950">教师</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li>使用教师账号登录。学生列表、兑换发放和加分记录仅覆盖超级管理员授权的区域。</li>
              <li>「课堂模式」可随机点名并即时加减分；空格点名，+ / - 键快速加减 1 分，Esc 退出。</li>
              <li>单人加分前核对学生姓名和学号，并填写准确原因。</li>
              <li>批量加分可拖入 Excel，检查公式预览和错误行后再确认入账。</li>
              <li>教师可提交校园主题视频，但必须由管理员审核通过后才会出现在学生可选目录中。</li>
              <li>兑换发放页面可按状态核对记录并标记已发放。网络商品由系统自动发放，不需线下处理。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-950">管理员与超级管理员</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li>在「商品管理」添加商品，设置库存、积分价格、上架状态和可选的到期时间。</li>
              <li>库存兑换到 0 后商品会自动下架；管理员可补充库存并重新上架。</li>
              <li>「启幕宣传页」用于提交、审核和发布校园宣传内容。教师提交后需管理员审核；已发布内容修改后会立即生效。</li>
              <li>「校园视频审核」中核对视频标题、BV 号、简介与区域；只通过适合校园观看的内容，发现不合适或失效内容及时停用。</li>
              <li>超级管理员在「区域与权限」维护校区/年级/班级、分配教职工区域，并管理角色。</li>
              <li>教师内部标签只用于授权教职工的内部管理，不向学生展示，不得用于定向触发内容。</li>
            </ol>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900"><CircleHelp className="h-4 w-4"/>遇到问题</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              <li>积分或库存不符：先查看「积分明细」和「兑换记录」，再联系教师或管理员。</li>
              <li>看不到学生：请超级管理员检查区域归属与教职工授权。</li>
              <li>视频或宣传内容不合适：联系管理员下线；学生也可直接关闭自愿视频设置。</li>
              <li>不要分享密码、学生个人资料、数据库密钥或未授权的外部链接。</li>
            </ul>
          </section>

          <p className="flex items-start gap-2 text-sm text-ink-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>
            平台记录积分、兑换与管理操作以便核对。请按本人账号和授权区域使用。
          </p>
        </div>
      </article>
    </main>
  );
}
