"use client";
import {useLayoutEffect,type RefObject} from "react";
// One viewport owner per open chat. No scroll-to-top during typing or DOM mutation.
export function useMobileChatViewport(ref:RefObject<HTMLElement|null>,enabled:boolean){
 useLayoutEffect(()=>{
  if(!enabled||!window.matchMedia("(max-width:900px)").matches)return;
  const el=ref.current,app=el?.closest<HTMLElement>(".mobile-app");if(!el||!app)return;
  let frame=0,largest=window.visualViewport?.height||window.innerHeight;
  const root=document.documentElement;
  const measure=()=>{
   frame=0;const vv=window.visualViewport,height=vv?.height||window.innerHeight;largest=Math.max(largest,height);
   const focused=app.contains(document.activeElement)&&document.activeElement?.matches("textarea,input:not([type=file])");
   const keyboard=!!focused&&(largest-height>100||window.innerHeight-height>100);
   document.body.classList.toggle("owner-chat-keyboard",keyboard);
   const top=vv?.offsetTop||0;
   const banners=keyboard?0:[...document.querySelectorAll<HTMLElement>(".platform-announcement,.update-banner")].reduce((sum,b)=>{const r=b.getBoundingClientRect();return r.bottom>top&&r.top<top+100?sum+r.height:sum;},0);
   app.style.setProperty("--owner-chat-top",`${top+banners}px`);
   app.style.setProperty("--owner-chat-height",`${Math.max(160,height-banners)}px`);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  measure();window.visualViewport?.addEventListener("resize",schedule);window.visualViewport?.addEventListener("scroll",schedule);window.addEventListener("resize",schedule);app.addEventListener("focusin",schedule);app.addEventListener("focusout",schedule);
  const observer=new ResizeObserver(schedule);document.querySelectorAll(".platform-announcement,.update-banner").forEach(b=>observer.observe(b));
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.visualViewport?.removeEventListener("resize",schedule);window.visualViewport?.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);app.removeEventListener("focusin",schedule);app.removeEventListener("focusout",schedule);document.body.classList.remove("owner-chat-keyboard");document.body.style.overflow=oldOverflow;app.style.removeProperty("--owner-chat-top");app.style.removeProperty("--owner-chat-height");root.style.removeProperty("--owner-keyboard-height");};
 },[ref,enabled]);
}
