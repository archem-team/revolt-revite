import "./Ranking.scss";
import { useEffect, useState } from "preact/hooks";

import { VendorRankPlanner } from "./VendorRankPlanner";
import VendorRankPlannerPreview from "./VendorRankPlanner.preview";

type Language = "en" | "zh";

const copy = {
    en: {
        language: "中文",
        eyebrow: "PepChat · Ranking guide",
        title: "How ranking works",
        lede: "The ranking gives more visibility to vendors who actively support PepChat. Recent contributions count more, while older support still keeps some value.",
        back: "Back to PepChat",
        activeTitle: "Active support matters",
        activeBody:
            "Vendors who continue supporting PepChat are more likely to stay visible in the ranking. Older contributions do not disappear after 30 days. Their value decreases gradually, so every contribution still counts while recent support has a stronger effect.",
        summaryTitle: "The short version",
        summary:
            "On the day we record a contribution, $1 adds 1 point. After 60 days, it is worth half as much. After 120 days, it is worth one quarter. We calculate the score from each contribution, not from the lifetime total.",
        formulaTitle: "The formula",
        formula: "points = amount × 2^(−age in days ÷ 60)",
        scoreFormula: "server score = sum of all contribution points",
        tiersTitle: "How positions are assigned",
        highlight: "Highlight",
        positions: "Positions",
        qualification: "Qualification",
        reserved: "Reserved",
        reservedPos: "Position 0",
        reservedRule: "PepChat Official only.",
        elite: "Elite",
        elitePos: "Positions 1-3",
        eliteRule:
            "Active Elite placements come first. The open spots go to servers with the highest positive scores.",
        pro: "Pro",
        proPos: "Positions 4-9",
        proRule:
            "Active Pro placements come first. The open spots go to the servers with the next highest positive scores.",
        green: "Green Zone",
        greenPos: "After position 9",
        greenRule:
            "A current score of 100 or more. Servers are ordered by score.",
        fresh: "New",
        freshPos: "After Green",
        freshRule:
            "Servers marked New with less than $100 in lifetime support.",
        standard: "Standard",
        standardPos: "Remaining positions",
        standardRule: "Everyone else, ordered by score.",
        overrideNote:
            "Some agreements reserve an Elite, Pro, or Green placement for a set period. They can also change the server's colour. These placements do not add points to the score.",
        exampleTitle: "A worked example",
        exampleIntro:
            "We calculate every contribution separately. Here is what three $1,000 contributions would be worth on the same day:",
        today: "today",
        days60: "60 days ago",
        days120: "120 days ago",
        points: "points",
        total: "Total score",
        calcTitle: "See how support changes a score",
        calcIntro:
            "Use this to estimate your score and check whether it reaches the Green Zone. It cannot predict an exact position because other server scores and active placements also affect the order.",
        currentLabel: "Current score",
        currentHint: "Use 0 if the server has no previous support.",
        supportLabel: "New contribution (USD)",
        supportHint: "A newly recorded $1 contribution adds 1 point today.",
        projected: "Projected score today",
        qualifies: "Meets the Green Zone threshold",
        notQualifies: "Below the Green Zone threshold",
        gap: "Additional points needed today",
        after: "After",
        days: "days",
        estimatedScore: "Estimated score",
        tierCaveat:
            "A top-nine score may place a server in Elite or Pro. Your exact position depends on the live ranking.",
        detailsTitle: "Details that matter",
        detail1Title: "Scores age daily.",
        detail1:
            "A contribution does not expire on a fixed date. Its value halves every 60 days and keeps decreasing.",
        detail2Title:
            "The 100-point rule is current score, not lifetime total.",
        detail2:
            "A server may have contributed more than $100 over time but sit below Green after older contributions decay.",
        detail3Title: "Equal scores have deterministic tie-breakers.",
        detail3:
            "If two scores match, we compare lifetime support and then the server ID. The order is not random.",
        detail4Title: "Updates are automatic.",
        detail4:
            "We request a new calculation when a contribution is recorded. A scheduled job also refreshes the ranking, so a short delay is possible.",
        faqTitle: "Common questions",
        faq1q: "Can a $100 contribution guarantee Green?",
        faq1a: "A new $100 contribution adds 100 points when we record it, which meets the Green threshold at that time. It does not guarantee a position, and the score begins to decrease afterward.",
        faq2q: "Why can a position change without new support?",
        faq2a: "A server can leave the Green Zone when its score falls below 100. Scheduled calculations also remove expired placements. Within each score-based group, positions usually move when a contribution or placement changes.",
        faq3q: "Are contribution amounts public?",
        faq3a: "No. Vendors can see the ranking and colour, but not another server's contribution history.",
        footer: "PepChat ranking guide · 60-day half-life",
    },
    zh: {
        language: "EN",
        eyebrow: "PepChat · 排名指南",
        title: "排名机制说明",
        lede: "排名会让持续支持 PepChat 的商家获得更多曝光。近期捐赠的权重更高，较早的支持仍会保留一部分价值。",
        back: "返回 PepChat",
        activeTitle: "持续支持很重要",
        activeBody:
            "持续支持 PepChat 的商家更有机会在排名中保持较高的曝光。旧捐赠不会在 30 天后突然清零，而是逐渐降低分值。因此，每笔支持都会继续计入得分，近期支持的影响更大。",
        summaryTitle: "简要说明",
        summary:
            "捐赠记录当天，1 美元等于 1 分；60 天后剩一半，120 天后剩四分之一。系统根据每笔捐赠重新计算，而不是直接使用历史累计金额。",
        formulaTitle: "计算公式",
        formula: "分值 = 金额 × 2^(−距今天数 ÷ 60)",
        scoreFormula: "服务器得分 = 所有捐赠分值之和",
        tiersTitle: "排名位置如何分配",
        highlight: "标识",
        positions: "位置",
        qualification: "规则",
        reserved: "保留",
        reservedPos: "第 0 位",
        reservedRule: "仅限 PepChat Official。",
        elite: "Elite",
        elitePos: "第 1-3 位",
        eliteRule: "有效 Elite 协议优先，其余名额由正分最高的服务器获得。",
        pro: "Pro",
        proPos: "第 4-9 位",
        proRule: "有效 Pro 协议优先，其余名额由接下来的最高正分获得。",
        green: "Green Zone",
        greenPos: "第 9 位之后",
        greenRule: "当前得分至少 100 分，并按得分从高到低排列。",
        fresh: "New",
        freshPos: "Green 之后",
        freshRule: "被标记为 New 且历史累计支持少于 100 美元的服务器。",
        standard: "Standard",
        standardPos: "其余位置",
        standardRule: "其他服务器，仍按得分排序。",
        overrideNote:
            "位置协议具有开始和到期日期，可保留 Elite、Pro 或 Green 位置，也可能改变标识颜色。协议不会永久增加得分。",
        exampleTitle: "计算示例",
        exampleIntro:
            "三笔捐赠会分别计算，不会合并成一个历史余额。在同一个计算日期：",
        today: "今天",
        days60: "60 天前",
        days120: "120 天前",
        points: "分",
        total: "总得分",
        calcTitle: "查看新支持如何改变得分",
        calcIntro:
            "此计算器仅显示分值和 Green Zone 资格，不承诺具体位置；其他服务器的得分和有效位置协议都会影响排名。",
        currentLabel: "当前得分",
        currentHint: "如果没有过往支持，请填写 0。",
        supportLabel: "新增捐赠（美元）",
        supportHint: "新记录的 1 美元捐赠当天增加 1 分。",
        projected: "今天的预计得分",
        qualifies: "达到 Green Zone 门槛",
        notQualifies: "低于 Green Zone 门槛",
        gap: "今天还需要的分数",
        after: "经过",
        days: "天",
        estimatedScore: "预计得分",
        tierCaveat:
            "如果得分进入前九名，可能获得 Elite 或 Pro。具体位置只能通过实时排名确定。",
        detailsTitle: "需要注意的细节",
        detail1Title: "得分会逐日衰减。",
        detail1: "捐赠不会突然失效；其权重每 60 天减半，并继续逐渐降低。",
        detail2Title: "100 分指当前得分，不是历史累计金额。",
        detail2:
            "服务器历史累计可能超过 100 美元，但旧捐赠衰减后，当前得分仍可能低于 Green。",
        detail3Title: "同分时采用固定规则。",
        detail3:
            "系统先比较历史累计支持，再比较服务器 ID。Green 区域不会随机洗牌。",
        detail4Title: "系统会自动更新。",
        detail4:
            "记录捐赠后会请求重新计算，也可以通过定时任务运行。处理过程可能存在短暂延迟。",
        faqTitle: "常见问题",
        faq1q: "捐赠 100 美元能保证进入 Green 吗？",
        faq1a: "新捐赠 100 美元会立即产生 100 分，因此在该次计算时达到 Green 门槛。但它不保证固定位置，之后得分也会开始衰减。",
        faq2q: "没有新捐赠，位置为什么也可能变化？",
        faq2a: "得分衰减并跨过固定的 100 分门槛时，区域会变化；定时重算也会处理到期的位置协议。在按分排序的区域内，相对位置通常在支持金额或协议变化时改变。",
        faq3q: "捐赠金额会公开吗？",
        faq3a: "不会。商家只能看到排名和颜色标识，看不到其他服务器的捐赠记录。",
        footer: "PepChat 排名指南 · 60 天半衰期",
    },
} as const;

const futureDays = [30, 60, 120];

export default function Ranking() {
    const [language, setLanguage] = useState<Language>("en");
    const [currentScore, setCurrentScore] = useState("0");
    const [newSupport, setNewSupport] = useState("100");
    const t = copy[language];
    const current = Math.max(0, Number(currentScore) || 0);
    const support = Math.max(0, Number(newSupport) || 0);
    const projected = current + support;
    const gap = Math.max(0, 100 - projected);
    const showPlannerPreview =
        import.meta.env.DEV &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("plannerPreview");

    useEffect(() => {
        const previous = document.title;
        document.title =
            language === "en"
                ? "How Ranking Works · PepChat"
                : "排名机制说明 · PepChat";
        return () => {
            document.title = previous;
        };
    }, [language]);

    const tierRows = [
        ["reserved", t.reserved, t.reservedPos, t.reservedRule],
        ["elite", t.elite, t.elitePos, t.eliteRule],
        ["pro", t.pro, t.proPos, t.proRule],
        ["green", t.green, t.greenPos, t.greenRule],
        ["new", t.fresh, t.freshPos, t.freshRule],
        ["standard", t.standard, t.standardPos, t.standardRule],
    ];

    return (
        <div className="ranking-page" lang={language === "zh" ? "zh-CN" : "en"}>
            <header className="ranking-nav">
                <a
                    className="ranking-wordmark"
                    href="/"
                    aria-label="PepChat home">
                    PepChat
                </a>
                <div className="ranking-nav-actions">
                    <button
                        className="ranking-language"
                        type="button"
                        onClick={() =>
                            setLanguage(language === "en" ? "zh" : "en")
                        }
                        aria-label={
                            language === "en"
                                ? "切换为中文"
                                : "Switch to English"
                        }>
                        {t.language}
                    </button>
                    <a className="ranking-back" href="/">
                        {t.back}
                    </a>
                </div>
            </header>

            <main className="ranking-shell">
                <article className="ranking-document">
                    <header className="ranking-intro">
                        <p className="ranking-eyebrow">{t.eyebrow}</p>
                        <h1>{t.title}</h1>
                        <p className="ranking-lede">{t.lede}</p>
                    </header>

                    {showPlannerPreview ? (
                        <VendorRankPlannerPreview />
                    ) : (
                        <VendorRankPlanner language={language} />
                    )}

                    <aside className="ranking-active-support">
                        <span
                            className="ranking-active-mark"
                            aria-hidden="true"
                        />
                        <div>
                            <h2>{t.activeTitle}</h2>
                            <p>{t.activeBody}</p>
                        </div>
                    </aside>

                    <section>
                        <h2>{t.summaryTitle}</h2>
                        <p>{t.summary}</p>
                        <div
                            className="ranking-formula"
                            aria-label={t.formulaTitle}>
                            <span>{t.formulaTitle}</span>
                            <code>{t.formula}</code>
                            <code>{t.scoreFormula}</code>
                        </div>
                    </section>

                    <section>
                        <h2>{t.tiersTitle}</h2>
                        <div className="ranking-table-wrap">
                            <table className="ranking-tier-table">
                                <thead>
                                    <tr>
                                        <th>{t.highlight}</th>
                                        <th>{t.positions}</th>
                                        <th>{t.qualification}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tierRows.map(
                                        ([kind, label, position, rule]) => (
                                            <tr key={kind}>
                                                <td data-label={t.highlight}>
                                                    <span
                                                        className={`ranking-tier ranking-tier--${kind}`}>
                                                        {label}
                                                    </span>
                                                </td>
                                                <td data-label={t.positions}>
                                                    {position}
                                                </td>
                                                <td
                                                    data-label={
                                                        t.qualification
                                                    }>
                                                    {rule}
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="ranking-note">{t.overrideNote}</p>
                    </section>

                    <section>
                        <h2>{t.exampleTitle}</h2>
                        <p>{t.exampleIntro}</p>
                        <div className="ranking-example">
                            <div>
                                <span>$1,000 · {t.today}</span>
                                <strong>1,000 {t.points}</strong>
                            </div>
                            <div>
                                <span>$1,000 · {t.days60}</span>
                                <strong>500 {t.points}</strong>
                            </div>
                            <div>
                                <span>$1,000 · {t.days120}</span>
                                <strong>250 {t.points}</strong>
                            </div>
                            <div className="ranking-example-total">
                                <span>{t.total}</span>
                                <strong>1,750 {t.points}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="ranking-calculator">
                        <h2>{t.calcTitle}</h2>
                        <p>{t.calcIntro}</p>
                        <div className="ranking-fields">
                            <label>
                                <span>{t.currentLabel}</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentScore}
                                    onInput={(event) =>
                                        setCurrentScore(
                                            event.currentTarget.value,
                                        )
                                    }
                                />
                                <small>{t.currentHint}</small>
                            </label>
                            <label>
                                <span>{t.supportLabel}</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={newSupport}
                                    onInput={(event) =>
                                        setNewSupport(event.currentTarget.value)
                                    }
                                />
                                <small>{t.supportHint}</small>
                            </label>
                        </div>
                        <div className="ranking-result" aria-live="polite">
                            <div>
                                <span>{t.projected}</span>
                                <strong>{projected.toFixed(2)}</strong>
                            </div>
                            <p
                                className={
                                    projected >= 100
                                        ? "is-qualified"
                                        : "is-below"
                                }>
                                <span aria-hidden="true">
                                    {projected >= 100 ? "✓" : "○"}
                                </span>{" "}
                                {projected >= 100
                                    ? t.qualifies
                                    : t.notQualifies}
                            </p>
                            {gap > 0 && (
                                <p>
                                    {t.gap}: <strong>{gap.toFixed(2)}</strong>
                                </p>
                            )}
                        </div>
                        <div className="ranking-projection">
                            {futureDays.map((days) => (
                                <div key={days}>
                                    <span>
                                        {t.after} {days} {t.days}
                                    </span>
                                    <strong>
                                        {(
                                            projected * Math.pow(2, -days / 60)
                                        ).toFixed(2)}
                                    </strong>
                                    <small>{t.estimatedScore}</small>
                                </div>
                            ))}
                        </div>
                        <p className="ranking-note">{t.tierCaveat}</p>
                    </section>

                    <section>
                        <h2>{t.detailsTitle}</h2>
                        <div className="ranking-details">
                            {[
                                [t.detail1Title, t.detail1],
                                [t.detail2Title, t.detail2],
                                [t.detail3Title, t.detail3],
                                [t.detail4Title, t.detail4],
                            ].map(([title, body]) => (
                                <p key={title}>
                                    <strong>{title}</strong> {body}
                                </p>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2>{t.faqTitle}</h2>
                        <dl className="ranking-faq">
                            <div>
                                <dt>{t.faq1q}</dt>
                                <dd>{t.faq1a}</dd>
                            </div>
                            <div>
                                <dt>{t.faq2q}</dt>
                                <dd>{t.faq2a}</dd>
                            </div>
                            <div>
                                <dt>{t.faq3q}</dt>
                                <dd>{t.faq3a}</dd>
                            </div>
                        </dl>
                    </section>
                </article>
            </main>

            <footer className="ranking-footer">
                <span>{t.footer}</span>
                <a href="/">{t.back}</a>
            </footer>
        </div>
    );
}
