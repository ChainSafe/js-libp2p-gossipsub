export function messageIdToString (msgId: Uint8Array): string {
  return (new Uint8Array(msgId)).toString()
}
