const MOBILE_CHAT_MIN_HEIGHT = 288;
const MOBILE_CHAT_BOTTOM_GAP = 12;

export function projectChatAvailableHeight({
  sectionTop,
  viewportBottom,
  minHeight = MOBILE_CHAT_MIN_HEIGHT,
  bottomGap = MOBILE_CHAT_BOTTOM_GAP,
}: {
  sectionTop: number;
  viewportBottom: number;
  minHeight?: number;
  bottomGap?: number;
}) {
  return Math.max(
    minHeight,
    Math.floor(viewportBottom - Math.max(sectionTop, 0) - bottomGap),
  );
}
