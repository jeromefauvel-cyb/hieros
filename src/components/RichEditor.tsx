"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const MenuButton = ({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`px-2 py-1 text-[10px] border transition-colors ${
      active
        ? "border-[#FF8C00] text-[#FF8C00] bg-[#FF8C00]/10"
        : "border-[#00FF00]/20 text-[#00FF00]/60 hover:border-[#00FF00]/50 hover:text-[#00FF00]"
    }`}
  >
    {children}
  </button>
);

export default function RichEditor({ content, onChange }: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Placeholder.configure({ placeholder: "CONTENU DE LA PAGE..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[300px] p-4 focus:outline-none text-sm text-white/80 font-mono",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const addImage = () => {
    const url = prompt("URL DE L'IMAGE:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const url = prompt("URL DU LIEN:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-[#00FF00]/30 bg-black">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-[#00FF00]/20 bg-[#00FF00]/5">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="GRAS"
        >
          B
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="ITALIQUE"
        >
          I
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="SOULIGNER"
        >
          U
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="BARRER"
        >
          S
        </MenuButton>

        <span className="w-px bg-[#00FF00]/20 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="TITRE 1"
        >
          H1
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="TITRE 2"
        >
          H2
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="TITRE 3"
        >
          H3
        </MenuButton>

        <span className="w-px bg-[#00FF00]/20 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="LISTE"
        >
          LIST
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="LISTE NUMEROTEE"
        >
          1.
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="CITATION"
        >
          &ldquo;&rdquo;
        </MenuButton>

        <span className="w-px bg-[#00FF00]/20 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="ALIGNER GAUCHE"
        >
          &#x21E4;
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="CENTRER"
        >
          &#x21D4;
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="ALIGNER DROITE"
        >
          &#x21E5;
        </MenuButton>

        <span className="w-px bg-[#00FF00]/20 mx-1" />

        <MenuButton onClick={addImage} title="IMAGE">
          IMG
        </MenuButton>
        <MenuButton onClick={addLink} title="LIEN">
          LINK
        </MenuButton>
        {editor.isActive("link") && (
          <MenuButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="SUPPRIMER LIEN"
          >
            UNLINK
          </MenuButton>
        )}

        <span className="w-px bg-[#00FF00]/20 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="LIGNE HORIZONTALE"
        >
          HR
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="BLOC CODE"
        >
          CODE
        </MenuButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Editor styles */}
      <style jsx global>{`
        .ProseMirror {
          min-height: 300px;
          padding: 16px;
          font-family: "Courier New", monospace;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(0, 255, 0, 0.2);
          pointer-events: none;
          height: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .ProseMirror h1 {
          font-size: 1.5em;
          font-weight: bold;
          color: #ff8c00;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin: 1em 0 0.5em;
          border-bottom: 1px solid rgba(255, 140, 0, 0.3);
          padding-bottom: 0.3em;
        }
        .ProseMirror h2 {
          font-size: 1.2em;
          font-weight: bold;
          color: #00ff00;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0.8em 0 0.4em;
        }
        .ProseMirror h3 {
          font-size: 1em;
          font-weight: bold;
          color: #00ff00;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0.6em 0 0.3em;
        }
        .ProseMirror p {
          margin: 0.4em 0;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.4em 0;
        }
        .ProseMirror ul li {
          list-style-type: "▸ ";
          color: rgba(255, 255, 255, 0.7);
        }
        .ProseMirror ol li {
          color: rgba(255, 255, 255, 0.7);
        }
        .ProseMirror li::marker {
          color: #00ff00;
        }
        .ProseMirror blockquote {
          border-left: 2px solid #ff8c00;
          padding-left: 1em;
          margin: 0.6em 0;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }
        .ProseMirror a {
          color: #ff8c00;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .ProseMirror a:hover {
          color: #00ff00;
        }
        .ProseMirror img {
          max-width: 100%;
          border: 1px solid rgba(0, 255, 0, 0.2);
          margin: 0.6em 0;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid rgba(0, 255, 0, 0.3);
          margin: 1em 0;
        }
        .ProseMirror pre {
          background: rgba(0, 255, 0, 0.05);
          border: 1px solid rgba(0, 255, 0, 0.2);
          border-radius: 0;
          padding: 0.8em;
          margin: 0.6em 0;
          overflow-x: auto;
        }
        .ProseMirror code {
          font-family: "Courier New", monospace;
          color: #00ff00;
          font-size: 0.9em;
        }
        .ProseMirror strong {
          color: #ffffff;
          font-weight: bold;
        }
        .ProseMirror em {
          color: rgba(255, 255, 255, 0.6);
        }
        .ProseMirror s {
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
