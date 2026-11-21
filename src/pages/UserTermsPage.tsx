import { ArrowLeft } from 'lucide-react';

/**
 * 用户守则公开页面。
 * 独立于认证页面渲染，以便未登录用户也能阅读。
 */
export default function UserTermsPage() {
  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 text-[#374151] sm:py-12">
      <article className="mx-auto w-full max-w-[720px] rounded-xl border border-ink-100 bg-white px-5 py-6 shadow-soft sm:px-10 sm:py-10">
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </a>

        <header className="mb-8 border-b border-ink-100 pb-5">
          <p className="text-sm font-medium text-brand-700">积分商城</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-ink-950">积分商城用户守则</h1>
          <p className="mt-3 text-sm text-ink-500">版本：1.0 · 适用于本平台所有账号持有人</p>
        </header>

        <div className="space-y-8 text-base leading-[1.8] text-[#374151] [&_p]:my-4 [&_li]:my-2 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-[1.4] [&_h2]:text-ink-950 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-900 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          <section aria-labelledby="terms-general">
            <h2 id="terms-general">一、总则</h2>
            <p>
              积分商城用于支持校园学习激励与奖励活动。使用本平台即表示你同意遵守学校规章制度、本守则及适用法律法规。
              本守则适用于学生、教师和管理员账号。
            </p>
          </section>

          <section aria-labelledby="terms-points">
            <h2 id="terms-points">二、积分获取规则</h2>
            <ol>
              <li>积分由学校授权的教师或管理员依据真实的学习表现、活动参与及学校认可的其他事项发放。</li>
              <li>不得通过虚构表现、重复提交、冒用身份、篡改请求或利用系统漏洞获取积分。</li>
              <li>积分记录用于校园激励，不具有现金价值，不得私下买卖、转让或兑换现金。</li>
              <li>如对积分变动有疑问，请及时联系教师或管理员核查，不得自行尝试修改数据。</li>
            </ol>
          </section>

          <section aria-labelledby="terms-redemption">
            <h2 id="terms-redemption">三、积分兑换规则</h2>
            <ol>
              <li>兑换前请核对商品、数量、积分价格与库存；提交成功后会生成兑换记录并按规则扣减积分与库存。</li>
              <li>实物商品按页面提示等待教师线下发放；网络商品的下载内容仅供本人学习使用，未经许可不得传播或用于商业目的。</li>
              <li>商品可能因库存、活动安排或有效期变化而上架、下架；历史兑换记录仍用于核对已发生的兑换。</li>
              <li>如遇重复扣分、未收到商品或链接无法访问，请保留记录并联系教师或管理员处理。</li>
            </ol>
          </section>

          <section aria-labelledby="terms-account">
            <h2 id="terms-account">四、账号安全</h2>
            <h3>保护账号与密码</h3>
            <ol>
              <li>仅使用本人账号，不得借用、转让账号或尝试登录、查看、操作他人账号。</li>
              <li>
                <strong className="font-semibold text-ink-900">
                  首次登录后请尽快修改管理员提供的初始密码；不要继续使用或分享初始密码。
                </strong>
              </li>
              <li>设置不易被猜测的密码，不要将密码发给他人；在公共设备使用后请退出账号。</li>
              <li>发现密码泄露、异常登录或账号被他人使用时，立即修改密码并联系学校管理员。</li>
            </ol>

            <h3>保护平台与他人信息</h3>
            <ol>
              <li>不得扫描、攻击或恶意干扰平台，不得绕过登录、角色或区域权限访问未授权数据。</li>
              <li>教师和管理员只能在工作职责及获授权区域内查看、处理学生数据，不得无关收集、导出或传播。</li>
              <li>发现漏洞或数据异常时，请停止相关操作并报告管理员，不要继续利用或公开传播漏洞细节。</li>
            </ol>
          </section>

          <section aria-labelledby="terms-conduct">
            <h2 id="terms-conduct">五、文明使用与内容规范</h2>
            <ol>
              <li>尊重师生，遵守校园秩序，不得发布违法、欺凌、骚扰、歧视、暴力、色情或侵犯隐私的内容。</li>
              <li>不得利用平台进行未经学校审核的商业推广、广告、募捐或外部活动宣传。</li>
              <li>启幕宣传页等校园宣传内容必须经授权人员审核后发布；发现不准确、不适宜或失效内容，请联系管理员。</li>
            </ol>
          </section>

          <section aria-labelledby="terms-data">
            <h2 id="terms-data">六、隐私与数据处理</h2>
            <p>
              平台会处理完成登录、积分记账、兑换履约、权限管理和安全维护所必需的账号与操作数据。
              数据访问按角色与区域授权执行。用户不得擅自收集、截图传播或另作他用地处理他人的姓名、学号、积分及兑换记录。
            </p>
          </section>

          <section aria-labelledby="terms-violation">
            <h2 id="terms-violation">七、违规处理</h2>
            <p>
              对违反本守则或学校相关规定的行为，学校可根据实际情况采取提醒、撤销不当积分或兑换、暂停账号、调整权限等措施；
              涉及严重违规的，按学校制度处理。
            </p>
          </section>

          <section aria-labelledby="terms-final">
            <h2 id="terms-final">八、附则</h2>
            <p>
              学校可根据平台功能与管理要求更新本守则，并通过平台或校内渠道告知。更新后的守则适用于后续使用。
              本守则用于规范校内平台使用，不替代学校正式规章制度或适用法律法规。如有疑问，请联系任课教师、班主任或学校指定的平台管理员。
            </p>
          </section>
        </div>

        <footer className="mt-10 border-t border-ink-100 pt-5">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回登录
          </a>
        </footer>
      </article>
    </main>
  );
}
