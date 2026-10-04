/**
 * Conversation module — เจ้าของโหมดบทสนทนา LINE และการบันทึกข้อความ + broadcast
 * ผู้เรียก (bot engine, admin routes) ใช้ผ่านไฟล์นี้; recording-transport import ตรงจากเทสต์เท่านั้น
 */
export { MODE_TRANSITIONS, allowedSourceModes, canTransition, isHumanHandled } from './modes';
export { httpLineTransport, type LineTransport } from './transport';
export {
  recordBotReplies,
  recordInboundMessage,
  type InboundMessage,
  type InboundMessageType,
} from './message-service';
export {
  changeMode,
  linkCase,
  transferOwnership,
  type ChangeModeOptions,
  type LinkCaseResult,
  type ModeChangeResult,
  type TransferInput,
} from './mode-service';
