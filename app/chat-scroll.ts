export type ComparableChatMessage = {
  id: string;
  authorName: string;
  authorClientId?: string | null;
  authorIsGm?: boolean | null;
  emoji: string;
  color: string;
  content: string;
  rollDetail: string | null;
  visibility?: string | null;
  recipientClientId?: string | null;
  recipientName?: string | null;
  tone?: string | null;
  createdAt: string;
};

export function chatMessagesEqual(current: ComparableChatMessage[], incoming: ComparableChatMessage[]) {
  if (current.length !== incoming.length) return false;
  return current.every((message, index) => {
    const next = incoming[index];
    return message.id === next.id
      && message.authorName === next.authorName
      && message.authorClientId === next.authorClientId
      && message.authorIsGm === next.authorIsGm
      && message.emoji === next.emoji
      && message.color === next.color
      && message.content === next.content
      && message.rollDetail === next.rollDetail
      && message.visibility === next.visibility
      && message.recipientClientId === next.recipientClientId
      && message.recipientName === next.recipientName
      && message.tone === next.tone
      && message.createdAt === next.createdAt;
  });
}

export function chatIsNearBottom(scrollTop: number, clientHeight: number, scrollHeight: number, tolerance = 36) {
  return scrollHeight - scrollTop - clientHeight <= tolerance;
}
