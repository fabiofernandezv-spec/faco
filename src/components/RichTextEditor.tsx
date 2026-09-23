import { useEffect } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Underline, Heading2, List, ListOrdered, Quote, Minus } from 'lucide-react';
import clsx from 'clsx';
import { sanitizeHtml } from '../lib/sanitize';

export { htmlToPlainText } from '../lib/sanitize';

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
      aria-label={title}
      aria-pressed={active}
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

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold:        e.isActive('bold'),
      italic:      e.isActive('italic'),
      underline:   e.isActive('underline'),
      heading:     e.isActive('heading', { level: 2 }),
      bulletList:  e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote:  e.isActive('blockquote'),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
      <Btn onClick={() => chain().toggleBold().run()}      title="Negrita (Ctrl+B)"   active={state.bold}><Bold className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => chain().toggleItalic().run()}    title="Cursiva (Ctrl+I)"   active={state.italic}><Italic className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => chain().toggleUnderline().run()} title="Subrayado (Ctrl+U)" active={state.underline}><Underline className="h-3.5 w-3.5" /></Btn>
      <Divider />
      <Btn onClick={() => chain().toggleHeading({ level: 2 }).run()} title="Título" active={state.heading}><Heading2 className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => chain().setParagraph().run()} title="Párrafo normal">
        <span className="text-xs font-medium px-0.5">¶</span>
      </Btn>
      <Divider />
      <Btn onClick={() => chain().toggleBulletList().run()}  title="Lista con viñetas" active={state.bulletList}><List className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => chain().toggleOrderedList().run()} title="Lista numerada"    active={state.orderedList}><ListOrdered className="h-3.5 w-3.5" /></Btn>
      <Divider />
      <Btn onClick={() => chain().toggleBlockquote().run()}  title="Cita" active={state.blockquote}><Quote className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => chain().setHorizontalRule().run()} title="Separador"><Minus className="h-3.5 w-3.5" /></Btn>
      <Divider />
      <Btn onClick={() => chain().unsetAllMarks().clearNodes().run()} title="Limpiar formato">
        <span className="text-xs font-mono">Tx</span>
      </Btn>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, disabled, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: false,
      }),
    ],
    // TipTap solo conserva los nodos de su esquema; además saneamos la entrada.
    content: sanitizeHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: clsx(
          'min-h-72 px-4 py-3 text-sm focus:outline-none leading-relaxed',
          '[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_hr]:border-gray-200 [&_hr]:my-4 [&_p]:mb-2',
          disabled && 'text-gray-500',
        ),
        'aria-label': placeholder ?? 'Editor de texto',
      },
    },
    onUpdate: ({ editor: e }) => onChange(sanitizeHtml(e.getHTML())),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Si el valor cambia desde fuera (p. ej. llegó una versión nueva), actualizar.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const clean = sanitizeHtml(value);
    if (clean !== editor.getHTML()) editor.commands.setContent(clean, { emitUpdate: false });
  }, [editor, value]);

  const isEmpty = !editor || editor.isEmpty;

  return (
    <div className={clsx('border rounded-lg overflow-hidden relative', disabled ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500')}>
      {!disabled && editor && <Toolbar editor={editor} />}
      {isEmpty && placeholder && !disabled && (
        <p className="pointer-events-none absolute left-4 top-[3.1rem] text-sm text-gray-300">{placeholder}</p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
