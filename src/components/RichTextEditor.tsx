import { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Heading2, List, ListOrdered, Quote, Minus } from 'lucide-react';
import clsx from 'clsx';

function Btn({
  onClick, title, children, active,
}: {
  onClick: () => void; title: string; children: React.ReactNode; active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={clsx(
        'p-1.5 rounded transition-colors',
        active ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, disabled, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value into DOM only on mount or when disabled (read-only mode)
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function exec(command: string, val?: string) {
    document.execCommand(command, false, val ?? undefined);
    editorRef.current?.focus();
    sync();
  }

  function sync() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function isActive(command: string) {
    try { return document.queryCommandState(command); } catch { return false; }
  }

  return (
    <div className={clsx('border rounded-lg overflow-hidden', disabled ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500')}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <Btn onClick={() => exec('bold')}          title="Negrita (Ctrl+B)"  active={isActive('bold')}>         <Bold         className="h-3.5 w-3.5" /></Btn>
          <Btn onClick={() => exec('italic')}        title="Cursiva (Ctrl+I)"  active={isActive('italic')}>       <Italic       className="h-3.5 w-3.5" /></Btn>
          <Btn onClick={() => exec('underline')}     title="Subrayado (Ctrl+U)" active={isActive('underline')}>  <Underline    className="h-3.5 w-3.5" /></Btn>
          <Divider />
          <Btn onClick={() => exec('formatBlock', '<h2>')}  title="Título">    <Heading2     className="h-3.5 w-3.5" /></Btn>
          <Btn onClick={() => exec('formatBlock', '<p>')}   title="Párrafo normal">
            <span className="text-xs font-medium px-0.5">¶</span>
          </Btn>
          <Divider />
          <Btn onClick={() => exec('insertUnorderedList')}  title="Lista con viñetas"  active={isActive('insertUnorderedList')}>   <List         className="h-3.5 w-3.5" /></Btn>
          <Btn onClick={() => exec('insertOrderedList')}    title="Lista numerada"     active={isActive('insertOrderedList')}>     <ListOrdered  className="h-3.5 w-3.5" /></Btn>
          <Divider />
          <Btn onClick={() => exec('formatBlock', '<blockquote>')} title="Cita"><Quote className="h-3.5 w-3.5" /></Btn>
          <Btn onClick={() => exec('insertHorizontalRule')}        title="Separador">  <Minus className="h-3.5 w-3.5" /></Btn>
          <Divider />
          <Btn onClick={() => exec('removeFormat')} title="Limpiar formato">
            <span className="text-xs font-mono">Tx</span>
          </Btn>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={sync}
        data-placeholder={placeholder}
        className={clsx(
          'min-h-72 px-4 py-3 text-sm focus:outline-none leading-relaxed',
          'prose prose-sm max-w-none',
          '[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_hr]:border-gray-200 [&_hr]:my-4',
          disabled && 'text-gray-500',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300'
        )}
      />
    </div>
  );
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
