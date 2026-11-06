/* Multiplayer peer-to-peer (WebRTC con Trystero): nessun server tuo, funziona anche su GitHub Pages.
   Due persone che scrivono lo stesso codice stanza entrano nello stesso presepe e si vedono. */
import { joinRoom, selfId } from "./vendor/trystero.js";

export const NET_APP_ID = "isiss-matese-nativita-ar";
export { selfId };

// pos: [x, y, z, yaw, pitch, colore, sx,sy,sz (mano sinistra), dx,dy,dz (mano destra)] nelle coordinate del presepe, mani = null se non ci sono
// emo: un evento breve ("heart", "magic", "cow", "star", "manger")
export function connectNet(roomId, { onPeerState, onPeerJoin, onPeerLeave, onEvent }){
  const room = joinRoom({ appId: NET_APP_ID }, roomId);
  const pos = room.makeAction("pos"), emo = room.makeAction("emo");
  const who = m => (m && m.peerId !== undefined) ? m.peerId : m;
  pos.onMessage = (d, meta) => { if (Array.isArray(d) && d.length === 12) onPeerState(who(meta), d); };
  emo.onMessage = (d, meta) => { if (typeof d === "string") onEvent(who(meta), d); };
  room.onPeerJoin = id => onPeerJoin(id);
  room.onPeerLeave = id => onPeerLeave(id);
  return {
    send: d => { try { pos.send(d); } catch (e) {} },
    event: k => { try { emo.send(k); } catch (e) {} },
    leave: () => { try { room.leave(); } catch (e) {} }
  };
}
