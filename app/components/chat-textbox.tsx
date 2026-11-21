"use client";
import { useLayoutEffect, useRef, type Ref } from "react";

/** A plain-text chat editor, outside the browser's form-field navigation. */
export function ChatTextbox({ value, onChange, placeholder, label, id, editorRef }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  id?: string;
  editorRef?: Ref<HTMLDivElement>;
}) {
  const element = useRef<HTMLDivElement | null>(null);
  const composing = useRef(false);
  const emitted = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = element.current;
    if (!el || composing.current || value === emitted.current && el.innerText === value) return;
    if (value !== emitted.current || !value) {
      el.textContent = value;
      if (document.activeElement === el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    emitted.current = value;
  }, [value]);
  function update(el: HTMLDivElement) {
    if (composing.current) return;
    let text = el.innerText.replace(/\r\n?/g, "\n");
    // WebKit may leave a single line break in an otherwise empty editor.
    if (!text.trim() && !el.textContent) text = "";
    if (text.length > 3000) {
      text = text.slice(0, 3000);
      el.textContent = text;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    emitted.current = text;
    onChange(text);
  }
  return <div
    ref={(el) => {
      element.current = el;
      if (typeof editorRef === "function") editorRef(el);
      else if (editorRef) editorRef.current = el;
    }}
    id={id}
    className="chat-textbox"
    role="textbox"
    aria-label={label}
    aria-multiline="true"
    data-placeholder={placeholder}
    contentEditable="plaintext-only"
    suppressContentEditableWarning
    autoCapitalize="sentences"
    autoCorrect="on"
    spellCheck
    inputMode="text"
    enterKeyHint="enter"
    onInput={(e) => update(e.currentTarget)}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={(e) => { composing.current = false; update(e.currentTarget); }}
  />;
}
