import styled, { keyframes } from "styled-components/macro";

const shimmer = keyframes`
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
`;

const shimmerStyle = `
    background: linear-gradient(
        90deg,
        var(--secondary-background) 25%,
        var(--hover) 50%,
        var(--secondary-background) 75%
    );
    background-size: 200% 100%;
`;

const SkeletonAvatar = styled.div<{ delay?: number }>`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    ${shimmerStyle}
    animation: ${shimmer} 1.5s ease-in-out infinite;
    animation-delay: ${(props) => props.delay ?? 0}s;
`;

const SkeletonBar = styled.div<{ w?: string; h?: string; delay?: number }>`
    width: ${(props) => props.w ?? "100%"};
    height: ${(props) => props.h ?? "14px"};
    border-radius: var(--border-radius);
    ${shimmerStyle}
    animation: ${shimmer} 1.5s ease-in-out infinite;
    animation-delay: ${(props) => props.delay ?? 0}s;
`;

const SkeletonRow = styled.div<{ head?: boolean }>`
    display: flex;
    flex-direction: row;
    padding: 0.125rem;
    padding-inline-end: 16px;
    margin-top: ${(props) => (props.head ? "12px" : "0")};
`;

const InfoColumn = styled.div`
    width: 62px;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    padding-top: 2px;
`;

const ContentColumn = styled.div`
    min-width: 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const DetailRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
`;

const SkeletonContainer = styled.div<{ align?: string }>`
    height: 100rem;
    overflow: hidden;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: ${(props) =>
        props.align === "start" ? "flex-start" : "flex-end"};
`;

const CONTENT_WIDTHS = ["90%", "75%", "60%", "85%", "70%", "55%", "80%"];
const NAME_WIDTHS = ["100px", "140px", "80px", "120px", "95px", "130px"];
const GROUP_PATTERN = [3, 2, 1, 4, 2, 3, 1, 2];

function buildPattern(count: number) {
    const items: { head: boolean; contentLines: number }[] = [];
    let groupIdx = 0;
    let widthSeed = 0;

    while (items.length < count) {
        items.push({ head: true, contentLines: 1 + (widthSeed++ % 2) });
        const bodyCount = GROUP_PATTERN[groupIdx % GROUP_PATTERN.length];
        for (let b = 0; b < bodyCount && items.length < count; b++) {
            items.push({ head: false, contentLines: 1 });
        }
        groupIdx++;
    }

    return items;
}

function SkeletonRows({ count = 30 }: { count?: number }) {
    const pattern = buildPattern(count);
    let widthIdx = 0;
    let nameIdx = 0;

    return (
        <>
            {pattern.map((item, i) => {
                const delay = (i % 15) * 0.1;

                if (item.head) {
                    const lines = [];
                    for (let l = 0; l < item.contentLines; l++) {
                        lines.push(
                            <SkeletonBar
                                key={l}
                                w={CONTENT_WIDTHS[widthIdx++ % CONTENT_WIDTHS.length]}
                                delay={delay}
                            />,
                        );
                    }
                    return (
                        <SkeletonRow key={i} head>
                            <InfoColumn>
                                <SkeletonAvatar delay={delay} />
                            </InfoColumn>
                            <ContentColumn>
                                <DetailRow>
                                    <SkeletonBar
                                        w={NAME_WIDTHS[nameIdx++ % NAME_WIDTHS.length]}
                                        h="14px"
                                        delay={delay}
                                    />
                                    <SkeletonBar w="50px" h="10px" delay={delay} />
                                </DetailRow>
                                {lines}
                            </ContentColumn>
                        </SkeletonRow>
                    );
                }

                return (
                    <SkeletonRow key={i}>
                        <InfoColumn />
                        <ContentColumn>
                            <SkeletonBar
                                w={CONTENT_WIDTHS[widthIdx++ % CONTENT_WIDTHS.length]}
                                delay={delay}
                            />
                        </ContentColumn>
                    </SkeletonRow>
                );
            })}
        </>
    );
}

interface SkeletonMessagesProps {
    count?: number;
    align?: "start" | "end";
    contained?: boolean;
}

/**
 * Skeleton loading messages.
 * - contained=false (default): bare rows, used for initial LOADING state
 * - contained=true: fixed-height container, used for pagination
 */
export function SkeletonMessages({
    count = 30,
    align = "end",
    contained = false,
}: SkeletonMessagesProps) {
    if (contained) {
        return (
            <SkeletonContainer align={align}>
                <SkeletonRows count={count} />
            </SkeletonContainer>
        );
    }

    return <SkeletonRows count={count} />;
}
