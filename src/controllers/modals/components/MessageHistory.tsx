import { observer } from "mobx-react-lite";
import { Message as MessageObject, API } from "revolt.js";
import styled from "styled-components";
import { decodeTime } from "ulid";
import { useMemo } from "preact/hooks";
import { Modal, H1, Row, Column, IconButton } from "@revoltchat/ui";
import { X } from "@styled-icons/boxicons-regular";

import { dayjs } from "../../../context/Locale";
import { ModalProps, MessageEditHistory } from "../types";
import Markdown from "../../../components/markdown/Markdown";
import Embed from "../../../components/common/messaging/embed/Embed";
import { MessageAreaWidthContext } from "../../../pages/channels/messaging/MessageArea";

const ModalContainer = styled.div`
    display: flex;
    flex-direction: column;
    max-height: 70vh;
    width: 550px;
    max-width: 100%;
    overflow: hidden;
`;

const TimelineList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
    padding: 8px 4px;
    margin-top: 12px;
    flex-grow: 1;

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: var(--hover);
        border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb:hover {
        background: var(--tertiary-foreground);
    }
`;

const Card = styled.div`
    background: var(--secondary-background);
    border: 1px solid var(--hover);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease, border-color 0.2s ease;

    &:hover {
        border-color: var(--tertiary-foreground);
    }
`;

const CardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border-bottom: 1px solid var(--hover);
    padding-bottom: 8px;
    margin-bottom: 4px;
`;

const Badge = styled.span<{ variant: "latest" | "original" | "edit" }>`
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    background: ${props =>
        props.variant === "latest"
            ? "rgba(46, 160, 67, 0.12)"
            : props.variant === "original"
            ? "var(--hover)"
            : "rgba(56, 139, 253, 0.12)"};
    color: ${props =>
        props.variant === "latest"
            ? "var(--success)"
            : props.variant === "original"
            ? "var(--tertiary-foreground)"
            : "var(--accent)"};
    border: 1px solid ${props =>
        props.variant === "latest"
            ? "rgba(46, 160, 67, 0.25)"
            : props.variant === "original"
            ? "var(--hover)"
            : "rgba(56, 139, 253, 0.25)"};
`;

const Timestamp = styled.span`
    font-size: 11px;
    color: var(--tertiary-foreground);
`;

const SectionTitle = styled.div`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--tertiary-foreground);
    margin-top: 8px;
    letter-spacing: 0.5px;
`;

const DiffContainer = styled.div`
    background: var(--secondary-header);
    border-radius: 6px;
    padding: 12px;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid var(--hover);
    margin-top: 4px;
    line-height: 1.5;
    font-size: 12px;
`;

const DiffSpan = styled.span<{ type: "added" | "removed" | "none" }>`
    background: ${props =>
        props.type === "added"
            ? "rgba(46, 160, 67, 0.12)"
            : props.type === "removed"
            ? "rgba(248, 81, 73, 0.12)"
            : "transparent"};
    color: ${props =>
        props.type === "added"
            ? "var(--success)"
            : props.type === "removed"
            ? "var(--error)"
            : "inherit"};
    text-decoration: ${props => props.type === "removed" ? "line-through" : "none"};
    padding: 1px 2px;
    border-radius: 2px;
`;

const EmptyState = styled.div`
    text-align: center;
    color: var(--tertiary-foreground);
    padding: 24px;
    font-size: 14px;
`;

interface DiffToken {
    type: "added" | "removed" | "none";
    value: string;
}

function diffWords(oldStr: string = "", newStr: string = ""): DiffToken[] {
    if (!oldStr) return [{ type: "added", value: newStr }];
    if (!newStr) return [{ type: "removed", value: oldStr }];

    const oldWords = oldStr.split(/(\s+)/).filter(Boolean);
    const newWords = newStr.split(/(\s+)/).filter(Boolean);

    if (oldWords.length > 800 || newWords.length > 800) {
        return [
            { type: "removed", value: oldStr },
            { type: "added", value: newStr }
        ];
    }

    const dp: number[][] = Array(oldWords.length + 1)
        .fill(null)
        .map(() => Array(newWords.length + 1).fill(0));

    for (let i = 1; i <= oldWords.length; i++) {
        for (let j = 1; j <= newWords.length; j++) {
            if (oldWords[i - 1] === newWords[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    let i = oldWords.length;
    let j = newWords.length;
    const result: DiffToken[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
            result.push({ type: "none", value: oldWords[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.push({ type: "added", value: newWords[j - 1] });
            j--;
        } else {
            result.push({ type: "removed", value: oldWords[i - 1] });
            i--;
        }
    }

    return result.reverse();
}

function MessageHistory({ message, ...props }: ModalProps<"message_history">) {
    const historyList = useMemo(() => {
        const list: { content?: string; embeds?: API.Embed[]; edited_at: string; isLatest?: boolean; isOriginal?: boolean }[] = [];
        
        const rawHistory = (message as any).edit_history as MessageEditHistory[] | undefined;
        if (rawHistory && rawHistory.length > 0) {
            rawHistory.forEach((item, index) => {
                list.push({
                    content: item.content,
                    embeds: item.embeds,
                    edited_at: item.edited_at,
                    isOriginal: index === 0,
                });
            });
        }

        // Add the current version at the end
        list.push({
            content: message.content ?? undefined,
            embeds: message.embeds ?? undefined,
            edited_at: message.edited || new Date().toISOString(),
            isLatest: true,
            isOriginal: list.length === 0,
        });

        // Return from newest to oldest
        return list.reverse();
    }, [message, (message as any).edit_history, message.content, message.embeds, message.edited]);

    return (
        <Modal
            {...props}
            title={
                <Row centred>
                    <Column grow>
                        <H1>Message Edit History</H1>
                    </Column>
                    <IconButton onClick={props.onClose}>
                        <X size={36} />
                    </IconButton>
                </Row>
            }
            actions={[
                {
                    onClick: () => {
                        props.onClose();
                        return true;
                    },
                    children: "Close",
                    palette: "primary",
                }
            ]}>
            <ModalContainer>
                {historyList.length <= 1 && !message.edited ? (
                    <EmptyState>No edit history available for this message.</EmptyState>
                ) : (
                    <MessageAreaWidthContext.Provider value={500}>
                        <TimelineList>
                            {historyList.map((version, index) => {
                                const prevVersion = historyList[index + 1];
                                const hasDiff = prevVersion && (version.content !== prevVersion.content);
                                const diffResult = hasDiff ? diffWords(prevVersion.content || "", version.content || "") : null;

                                return (
                                    <Card key={version.edited_at + index}>
                                        <CardHeader>
                                            {version.isLatest ? (
                                                <Badge variant="latest">Current Version</Badge>
                                            ) : version.isOriginal ? (
                                                <Badge variant="original">Original Version</Badge>
                                            ) : (
                                                <Badge variant="edit">Edit #{historyList.length - 1 - index}</Badge>
                                            )}
                                            <Timestamp>
                                                {version.isOriginal ? "Sent: " : "Edited: "}
                                                {dayjs(version.isOriginal ? decodeTime(message._id) : version.edited_at).format("LLLL")}
                                                {" ("}
                                                {dayjs(version.isOriginal ? decodeTime(message._id) : version.edited_at).fromNow()}
                                                {")"}
                                            </Timestamp>
                                        </CardHeader>

                                        {version.content && (
                                            <div>
                                                <Markdown content={version.content} />
                                            </div>
                                        )}

                                        {version.embeds && version.embeds.length > 0 && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                {version.embeds.map((embed, idx) => (
                                                    <Embed key={idx} embed={embed} />
                                                ))}
                                            </div>
                                        )}

                                        {diffResult && (
                                            <div>
                                                <SectionTitle>Changes in this edit</SectionTitle>
                                                <DiffContainer>
                                                    {diffResult.map((part, idx) => (
                                                        <DiffSpan key={idx} type={part.type}>
                                                            {part.value}
                                                        </DiffSpan>
                                                    ))}
                                                </DiffContainer>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </TimelineList>
                    </MessageAreaWidthContext.Provider>
                )}
            </ModalContainer>
        </Modal>
    );
}

export default observer(MessageHistory);
