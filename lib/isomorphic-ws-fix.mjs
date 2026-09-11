const ws = typeof WebSocket !== "undefined" ? WebSocket : null;

export default ws;
export { ws as WebSocket };
