"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

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
        ? "border-[#DF8301] text-[#DF8301] bg-[#DF8301]/10"
        : "border-[#33FF33]/20 text-[#33FF33]/60 hover:border-[#33FF33]/50 hover:text-[#33FF33]"
    }`}
  >
    {children}
  </button>
);

interface MediaFile {
  name: string;
  url: string;
  type: string;
}

export default function RichEditor({ content, onChange }: RichEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await fetch("/api/admin/upload");
      if (res.ok) setMediaFiles(await res.json());
    } catch { /* ignore */ }
    setMediaLoading(false);
  }, []);

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
      TextStyle,
      Color,
      Youtube.configure({ width: 640, height: 360 }),
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

  const uploadFile = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        alert(err.error || "ERREUR UPLOAD");
        return;
      }
      const { url } = await res.json();
      if (file.type.startsWith("video/")) {
        editor.chain().focus().insertContent(
          `<div class="media-wrapper"><video src="${url}" controls></video></div>`
        ).run();
      } else {
        editor.chain().focus().insertContent(
          `<div class="media-wrapper"><img src="${url}" /></div>`
        ).run();
      }
    } catch {
      alert("ERREUR UPLOAD");
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        uploadFile(file);
      }
    }
  }, [uploadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      uploadFile(files[i]);
    }
    e.target.value = "";
  }, [uploadFile]);

  const insertMediaFromLibrary = useCallback((file: MediaFile) => {
    if (!editor) return;
    const isVideo = file.type?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(file.name);
    if (isVideo) {
      editor.chain().focus().insertContent(
        `<div class="media-wrapper"><video src="${file.url}" controls></video></div>`
      ).run();
    } else {
      editor.chain().focus().insertContent(
        `<div class="media-wrapper"><img src="${file.url}" /></div>`
      ).run();
    }
    setShowMediaPicker(false);
  }, [editor]);

  if (!editor) return null;

  const addImage = () => {
    const url = prompt("URL DE L'IMAGE:");
    if (url) {
      editor.chain().focus().insertContent(
        `<div class="media-wrapper"><img src="${url}" /></div>`
      ).run();
    }
  };

  const addLink = () => {
    const url = prompt("URL DU LIEN:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addYoutube = () => {
    const url = prompt("URL YOUTUBE:");
    if (url) {
      editor.commands.setYoutubeVideo({ src: url });
    }
  };

  const addVideo = () => {
    const url = prompt("URL DE LA VIDEO:");
    if (url) {
      editor.chain().focus().insertContent(
        `<div class="media-wrapper"><video src="${url}" controls></video></div>`
      ).run();
    }
  };

  const addCarousel = () => {
    const input = prompt("URLS DES IMAGES/VIDEOS (separees par des virgules):");
    if (!input) return;
    const urls = input.split(",").map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return;
    const slides = urls.map((url) => {
      const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
      return `<div class="carousel-slide">${isVideo ? `<video src="${url}" controls></video>` : `<img src="${url}" />`}</div>`;
    }).join("");
    editor.chain().focus().insertContent(
      `<div class="media-carousel"><div class="carousel-track">${slides}</div><button class="carousel-prev">\u2039</button><button class="carousel-next">\u203A</button><div class="carousel-dots"></div></div>`
    ).run();
  };

  return (
    <div className="border border-[#33FF33]/30 bg-black">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-[#33FF33]/20 bg-[#33FF33]/5">
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

        <span className="w-px bg-[#33FF33]/20 mx-1" />

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

        <span className="w-px bg-[#33FF33]/20 mx-1" />

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

        <span className="w-px bg-[#33FF33]/20 mx-1" />

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

        <span className="w-px bg-[#33FF33]/20 mx-1" />

        <MenuButton onClick={addImage} title="IMAGE URL">
          IMG
        </MenuButton>
        <MenuButton onClick={() => fileInputRef.current?.click()} title="UPLOAD FICHIER">
          {uploading ? "..." : "DROP"}
        </MenuButton>
        <MenuButton
          onClick={() => { setShowMediaPicker(!showMediaPicker); if (!showMediaPicker) fetchMedia(); }}
          active={showMediaPicker}
          title="INSERER DEPUIS MEDIA"
        >
          MEDIA
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

        <span className="w-px bg-[#33FF33]/20 mx-1" />

        <MenuButton onClick={addYoutube} title="YOUTUBE">
          YT
        </MenuButton>
        <MenuButton onClick={addVideo} title="VIDEO URL">
          VID
        </MenuButton>
        <MenuButton onClick={addCarousel} title="CARROUSEL D'IMAGES">
          CAROUSEL
        </MenuButton>

        <span className="w-px bg-[#33FF33]/20 mx-1" />

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

        <span className="w-px bg-[#33FF33]/20 mx-1" />

        <div className="relative inline-flex items-center">
          <input
            ref={colorInputRef}
            type="color"
            value={editor.getAttributes("textStyle").color || "#ffffff"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <button
            type="button"
            title="COULEUR TEXTE"
            className="px-2 py-1 text-[10px] border border-[#33FF33]/20 text-[#33FF33]/60 hover:border-[#33FF33]/50 hover:text-[#33FF33] transition-colors flex items-center gap-1"
            onClick={() => colorInputRef.current?.click()}
          >
            A
            <span
              className="w-3 h-3 border border-white/30"
              style={{ backgroundColor: editor.getAttributes("textStyle").color || "#ffffff" }}
            />
          </button>
        </div>
        <MenuButton
          onClick={() => editor.chain().focus().unsetColor().run()}
          title="RESET COULEUR"
        >
          A&#x0336;
        </MenuButton>
      </div>

      {/* Media picker panel */}
      {showMediaPicker && (
        <div className="border-b border-[#33FF33]/20 bg-[#33FF33]/[0.02] p-2 max-h-[200px] overflow-y-auto">
          {mediaLoading ? (
            <p className="text-[#33FF33]/30 text-[10px] text-center py-4">CHARGEMENT...</p>
          ) : mediaFiles.length === 0 ? (
            <p className="text-white/30 text-[10px] text-center py-4">AUCUN MEDIA</p>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {mediaFiles.map((f) => {
                const isVideo = f.type?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(f.name);
                const isImage = f.type?.startsWith("image/") || /\.(gif|png|jpg|jpeg|webp|svg|bmp|avif)$/i.test(f.name);
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => insertMediaFromLibrary(f)}
                    className="aspect-square border border-[#33FF33]/15 hover:border-[#DF8301] transition-colors overflow-hidden flex items-center justify-center bg-black"
                    title={f.name}
                  >
                    {isVideo ? (
                      <video src={f.url} className="max-w-full max-h-full object-contain" muted />
                    ) : isImage ? (
                      <img src={f.url} alt={f.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-[#33FF33]/30 text-[8px]">FILE</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.gif"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Editor content with drag & drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative ${dragOver ? "ring-2 ring-[#DF8301] ring-inset" : ""}`}
      >
        {dragOver && (
          <div className="absolute inset-0 bg-[#DF8301]/10 z-10 flex items-center justify-center pointer-events-none">
            <span className="text-[#DF8301] text-sm tracking-widest font-bold">
              DROP FICHIER ICI
            </span>
          </div>
        )}
        {uploading && (
          <div className="absolute top-2 right-2 z-20 bg-black border border-[#DF8301]/50 px-3 py-1 text-[10px] text-[#DF8301] tracking-wider">
            UPLOAD EN COURS...
          </div>
        )}
        <EditorContent editor={editor} />
      </div>

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
          color: #df8301;
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
          border-left: 2px solid #df8301;
          padding-left: 1em;
          margin: 0.6em 0;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }
        .ProseMirror a {
          color: #df8301;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .ProseMirror a:hover {
          color: #00ff00;
        }
        .ProseMirror img {
          max-width: 100%;
        }
        .ProseMirror video {
          max-width: 100%;
        }
        .ProseMirror iframe {
          max-width: 100%;
        }
        .ProseMirror div[data-youtube-video] {
          margin: 0.6em 0;
          text-align: center;
        }
        .ProseMirror div[data-youtube-video] iframe {
          display: inline-block;
        }
        .ProseMirror .media-wrapper,
        .rich-content .media-wrapper {
          text-align: center;
          margin: 0.6em 0;
        }
        .ProseMirror .media-wrapper img,
        .ProseMirror .media-wrapper video,
        .rich-content .media-wrapper img,
        .rich-content .media-wrapper video {
          display: inline-block;
          max-width: 100%;
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
